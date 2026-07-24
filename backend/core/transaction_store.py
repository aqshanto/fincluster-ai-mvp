from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import Connection, inspect, text
from sqlalchemy.exc import SQLAlchemyError

from core.database import Database


class DatasetImportError(ValueError):
    """Raised when a reviewed CSV batch is invalid or out of sequence."""


class TransactionDatasetStore:
    """Privacy-aware transaction, review, import, and retraining store.

    PostgreSQL is selected when ``DATABASE_URL`` exists. Local development and
    tests continue using SQLite. Raw IP addresses, device IDs, terminal IDs,
    STANs, and RRNs are deliberately excluded from persistent storage.
    """

    REQUIRED_IMPORT_COLUMNS = {
        "event_uid",
        "amount",
        "tx_type",
        "account_age_days",
        "mcc",
        "is_vpn",
        "reviewed_label",
    }

    _MIGRATION_COLUMNS: dict[str, str] = {
        "review_status": "TEXT NOT NULL DEFAULT 'not_required'",
        "review_reason": "TEXT",
        "predicted_label": "TEXT",
        "model_probability": "REAL",
        "model_confidence": "REAL",
        "analysis_json": "TEXT",
        "reviewed_by": "TEXT",
        "prediction_correct": "INTEGER",
        "routed_after_review": "INTEGER NOT NULL DEFAULT 0",
    }

    def __init__(self, database: Database | None = None) -> None:
        self.database = database or Database()
        self.path: Path | None = None
        if self.database.storage_name == "sqlite":
            default_path = Path(__file__).resolve().parents[1] / "data" / "transactions.db"
            self.path = Path(os.getenv("AI_DATASET_PATH", str(default_path)))

        self.max_rows = max(300, int(os.getenv("AI_DATASET_MAX_ROWS", "10000")))
        self.auto_sample_every = max(1, int(os.getenv("AUTO_DATA_SAMPLE_EVERY", "25")))
        self._lock = threading.RLock()
        self._row_count = 0
        self._reviewed_count = 0
        self._pending_count = 0
        self._correct_count = 0
        self._incorrect_count = 0
        self._last_error: str | None = None
        self._initialize()

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _decode_json(value: str | None, fallback: Any) -> Any:
        if not value:
            return fallback
        try:
            return json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return fallback

    @staticmethod
    def _analysis_json(analysis: dict[str, Any]) -> str:
        safe = {
            "risk_score": analysis.get("risk_score", 0),
            "risk_level": analysis.get("risk_level", "low"),
            "task_path": analysis.get("task_path", "LIGHT FAST-PATH"),
            "is_heavy": bool(analysis.get("is_heavy", False)),
            "cpu_load_required": analysis.get("cpu_load_required", 5.0),
            "factors": analysis.get("factors", []),
            "classifier_source": analysis.get("classifier_source", "unknown"),
            "model_name": analysis.get("model_name", "unknown"),
            "confidence": analysis.get("confidence", 0.0),
            "model_probability": analysis.get("model_probability"),
            "predicted_label": analysis.get(
                "predicted_label", "heavy" if analysis.get("is_heavy") else "light"
            ),
            "api_used": bool(analysis.get("api_used", False)),
            "fallback_reason": analysis.get("fallback_reason"),
            "review_required": bool(analysis.get("review_required", False)),
            "review_reasons": analysis.get("review_reasons", []),
        }
        return json.dumps(safe, separators=(",", ":"), ensure_ascii=True)

    def _id_column(self) -> str:
        return "BIGSERIAL PRIMARY KEY" if self.database.is_postgresql else "INTEGER PRIMARY KEY AUTOINCREMENT"

    def _binary_column(self) -> str:
        return "BYTEA" if self.database.is_postgresql else "BLOB"

    def _initialize(self) -> None:
        try:
            with self._lock, self.database.transaction() as connection:
                connection.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS transactions (
                            record_id {self._id_column()},
                            event_uid TEXT UNIQUE NOT NULL,
                            run_id INTEGER NOT NULL,
                            event_id INTEGER NOT NULL,
                            created_at TEXT NOT NULL,
                            source TEXT NOT NULL,
                            amount REAL NOT NULL,
                            tx_type INTEGER NOT NULL,
                            account_age_days INTEGER NOT NULL,
                            mcc TEXT NOT NULL,
                            is_vpn INTEGER NOT NULL,
                            classifier_source TEXT NOT NULL,
                            model_name TEXT NOT NULL,
                            risk_score REAL NOT NULL,
                            risk_level TEXT NOT NULL,
                            is_heavy INTEGER NOT NULL,
                            task_path TEXT NOT NULL,
                            ai_route_node INTEGER,
                            legacy_route_node INTEGER,
                            ai_latency_ms REAL,
                            legacy_latency_ms REAL,
                            review_status TEXT NOT NULL DEFAULT 'not_required',
                            review_reason TEXT,
                            predicted_label TEXT,
                            model_probability REAL,
                            model_confidence REAL,
                            analysis_json TEXT,
                            reviewed_label TEXT,
                            reviewed_at TEXT,
                            reviewed_by TEXT,
                            prediction_correct INTEGER,
                            routed_after_review INTEGER NOT NULL DEFAULT 0
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS dataset_imports (
                            import_id {self._id_column()},
                            batch_id TEXT UNIQUE NOT NULL,
                            filename TEXT NOT NULL,
                            file_sha256 TEXT UNIQUE NOT NULL,
                            expected_start_reviewed INTEGER,
                            expected_end_reviewed INTEGER,
                            received_rows INTEGER NOT NULL,
                            inserted_rows INTEGER NOT NULL,
                            duplicate_rows INTEGER NOT NULL,
                            imported_by TEXT NOT NULL,
                            imported_at TEXT NOT NULL,
                            metadata_json TEXT
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS retraining_state (
                            state_id INTEGER PRIMARY KEY,
                            last_attempted_reviewed_rows INTEGER NOT NULL DEFAULT 0,
                            last_promoted_reviewed_rows INTEGER NOT NULL DEFAULT 0,
                            promotions INTEGER NOT NULL DEFAULT 0,
                            last_started_at TEXT,
                            last_completed_at TEXT,
                            last_error TEXT,
                            last_result_json TEXT,
                            updated_at TEXT NOT NULL
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS retraining_runs (
                            run_id {self._id_column()},
                            reviewed_rows INTEGER NOT NULL,
                            heavy_rows INTEGER NOT NULL,
                            light_rows INTEGER NOT NULL,
                            selected_algorithm TEXT,
                            model_name TEXT,
                            metrics_json TEXT,
                            candidate_metrics_json TEXT,
                            quality_passed INTEGER NOT NULL DEFAULT 0,
                            promoted INTEGER NOT NULL DEFAULT 0,
                            error TEXT,
                            started_at TEXT NOT NULL,
                            completed_at TEXT NOT NULL
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        CREATE TABLE IF NOT EXISTS model_artifacts (
                            artifact_id {self._id_column()},
                            model_version TEXT NOT NULL,
                            selected_algorithm TEXT NOT NULL,
                            artifact_bytes {self._binary_column()} NOT NULL,
                            metrics_json TEXT NOT NULL,
                            reviewed_rows INTEGER NOT NULL,
                            promoted_at TEXT NOT NULL
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_transactions_review_status ON transactions(review_status)"
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_transactions_reviewed_label ON transactions(reviewed_label)"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO retraining_state (state_id, updated_at) VALUES (1, :updated_at) "
                        "ON CONFLICT(state_id) DO NOTHING"
                    ),
                    {"updated_at": self._now()},
                )

            self._ensure_migration_columns()
            self.refresh_counts()
            self._last_error = None
        except (SQLAlchemyError, ValueError) as exc:
            self._last_error = f"Database initialization failed: {exc}"

    def _ensure_migration_columns(self) -> None:
        inspector = inspect(self.database.engine)
        existing = {str(column["name"]) for column in inspector.get_columns("transactions")}
        missing = [(name, definition) for name, definition in self._MIGRATION_COLUMNS.items() if name not in existing]
        if not missing:
            return
        with self.database.transaction() as connection:
            for name, definition in missing:
                connection.execute(text(f"ALTER TABLE transactions ADD COLUMN {name} {definition}"))

    def refresh_counts(self) -> None:
        try:
            with self._lock, self.database.transaction() as connection:
                self._refresh_counts(connection)
            self._last_error = None
        except SQLAlchemyError as exc:
            self._last_error = f"Database count refresh failed: {exc}"

    def _refresh_counts(self, connection: Connection) -> None:
        self._row_count = int(connection.execute(text("SELECT COUNT(*) FROM transactions")).scalar_one())
        self._reviewed_count = int(
            connection.execute(
                text("SELECT COUNT(*) FROM transactions WHERE reviewed_label IN ('heavy', 'light')")
            ).scalar_one()
        )
        self._pending_count = int(
            connection.execute(
                text("SELECT COUNT(*) FROM transactions WHERE review_status = 'pending'")
            ).scalar_one()
        )
        self._correct_count = int(
            connection.execute(
                text("SELECT COUNT(*) FROM transactions WHERE prediction_correct = 1")
            ).scalar_one()
        )
        self._incorrect_count = int(
            connection.execute(
                text("SELECT COUNT(*) FROM transactions WHERE prediction_correct = 0")
            ).scalar_one()
        )

    def _trim(self, connection: Connection) -> None:
        count = int(connection.execute(text("SELECT COUNT(*) FROM transactions")).scalar_one())
        overflow = max(0, count - self.max_rows)
        if not overflow:
            return
        connection.execute(
            text(
                """
                DELETE FROM transactions
                WHERE record_id IN (
                    SELECT record_id
                    FROM transactions
                    WHERE review_status != 'pending'
                    ORDER BY record_id ASC
                    LIMIT :overflow
                )
                """
            ),
            {"overflow": overflow},
        )

    def should_record(self, source: str, event_id: int) -> bool:
        return source == "manual" or event_id % self.auto_sample_every == 0

    def record(self, *, event: dict[str, Any], task: dict[str, Any], analysis: dict[str, Any]) -> bool:
        if not self.should_record(event["source"], int(event["event_id"])):
            return False

        run_id_text, _ = str(event["event_uid"]).split(":", 1)
        predicted_label = str(
            analysis.get("predicted_label", "heavy" if analysis["is_heavy"] else "light")
        )
        params = {
            "event_uid": str(event["event_uid"]),
            "run_id": int(run_id_text),
            "event_id": int(event["event_id"]),
            "created_at": self._now(),
            "source": event["source"],
            "amount": float(task["amount"]),
            "tx_type": int(task["tx_type"]),
            "account_age_days": int(task["account_age_days"]),
            "mcc": str(task.get("mcc", "5411")),
            "is_vpn": int(bool(task.get("is_vpn", False))),
            "classifier_source": str(analysis.get("classifier_source", "unknown")),
            "model_name": str(analysis.get("model_name", "unknown")),
            "risk_score": float(analysis["risk_score"]),
            "risk_level": str(analysis["risk_level"]),
            "is_heavy": int(bool(analysis["is_heavy"])),
            "task_path": str(analysis["task_path"]),
            "ai_route_node": event["ai_route"]["node_id"],
            "legacy_route_node": event["legacy_route"]["node_id"],
            "ai_latency_ms": event["ai_route"]["estimated_latency_ms"],
            "legacy_latency_ms": event["legacy_route"]["estimated_latency_ms"],
            "review_status": "feedback_optional" if event["source"] == "manual" else "not_required",
            "predicted_label": predicted_label,
            "model_probability": analysis.get("model_probability"),
            "model_confidence": float(analysis.get("confidence", 0.0)),
            "analysis_json": self._analysis_json(analysis),
        }
        try:
            with self._lock, self.database.transaction() as connection:
                connection.execute(
                    text(
                        """
                        INSERT INTO transactions (
                            event_uid, run_id, event_id, created_at, source, amount,
                            tx_type, account_age_days, mcc, is_vpn,
                            classifier_source, model_name, risk_score, risk_level,
                            is_heavy, task_path, ai_route_node, legacy_route_node,
                            ai_latency_ms, legacy_latency_ms, review_status,
                            predicted_label, model_probability, model_confidence,
                            analysis_json
                        ) VALUES (
                            :event_uid, :run_id, :event_id, :created_at, :source, :amount,
                            :tx_type, :account_age_days, :mcc, :is_vpn,
                            :classifier_source, :model_name, :risk_score, :risk_level,
                            :is_heavy, :task_path, :ai_route_node, :legacy_route_node,
                            :ai_latency_ms, :legacy_latency_ms, :review_status,
                            :predicted_label, :model_probability, :model_confidence,
                            :analysis_json
                        ) ON CONFLICT(event_uid) DO NOTHING
                        """
                    ),
                    params,
                )
                self._trim(connection)
                self._refresh_counts(connection)
            self._last_error = None
            return True
        except (SQLAlchemyError, ValueError) as exc:
            self._last_error = f"Database write failed: {exc}"
            return False

    def record_pending_review(
        self,
        *,
        event_uid: str,
        event_id: int,
        task: dict[str, Any],
        analysis: dict[str, Any],
    ) -> bool:
        run_id_text, _ = event_uid.split(":", 1)
        reasons = list(analysis.get("review_reasons") or ["Model requested human review"])
        predicted_label = str(
            analysis.get("predicted_label", "heavy" if analysis["is_heavy"] else "light")
        )
        params = {
            "event_uid": event_uid,
            "run_id": int(run_id_text),
            "event_id": int(event_id),
            "created_at": self._now(),
            "source": "manual",
            "amount": float(task["amount"]),
            "tx_type": int(task["tx_type"]),
            "account_age_days": int(task["account_age_days"]),
            "mcc": str(task.get("mcc", "5411")),
            "is_vpn": int(bool(task.get("is_vpn", False))),
            "classifier_source": str(analysis.get("classifier_source", "unknown")),
            "model_name": str(analysis.get("model_name", "unknown")),
            "risk_score": float(analysis["risk_score"]),
            "risk_level": str(analysis["risk_level"]),
            "is_heavy": int(bool(analysis["is_heavy"])),
            "task_path": str(analysis["task_path"]),
            "review_status": "pending",
            "review_reason": json.dumps(reasons, ensure_ascii=True),
            "predicted_label": predicted_label,
            "model_probability": analysis.get("model_probability"),
            "model_confidence": float(analysis.get("confidence", 0.0)),
            "analysis_json": self._analysis_json(analysis),
        }
        try:
            with self._lock, self.database.transaction() as connection:
                connection.execute(
                    text(
                        """
                        INSERT INTO transactions (
                            event_uid, run_id, event_id, created_at, source, amount,
                            tx_type, account_age_days, mcc, is_vpn,
                            classifier_source, model_name, risk_score, risk_level,
                            is_heavy, task_path, review_status, review_reason,
                            predicted_label, model_probability, model_confidence,
                            analysis_json
                        ) VALUES (
                            :event_uid, :run_id, :event_id, :created_at, :source, :amount,
                            :tx_type, :account_age_days, :mcc, :is_vpn,
                            :classifier_source, :model_name, :risk_score, :risk_level,
                            :is_heavy, :task_path, :review_status, :review_reason,
                            :predicted_label, :model_probability, :model_confidence,
                            :analysis_json
                        )
                        ON CONFLICT(event_uid) DO UPDATE SET
                            created_at = excluded.created_at,
                            amount = excluded.amount,
                            tx_type = excluded.tx_type,
                            account_age_days = excluded.account_age_days,
                            mcc = excluded.mcc,
                            is_vpn = excluded.is_vpn,
                            classifier_source = excluded.classifier_source,
                            model_name = excluded.model_name,
                            risk_score = excluded.risk_score,
                            risk_level = excluded.risk_level,
                            is_heavy = excluded.is_heavy,
                            task_path = excluded.task_path,
                            review_status = 'pending',
                            review_reason = excluded.review_reason,
                            predicted_label = excluded.predicted_label,
                            model_probability = excluded.model_probability,
                            model_confidence = excluded.model_confidence,
                            analysis_json = excluded.analysis_json,
                            reviewed_label = NULL,
                            reviewed_at = NULL,
                            reviewed_by = NULL,
                            prediction_correct = NULL,
                            routed_after_review = 0
                        """
                    ),
                    params,
                )
                self._trim(connection)
                self._refresh_counts(connection)
            self._last_error = None
            return True
        except (SQLAlchemyError, ValueError) as exc:
            self._last_error = f"Database pending-review write failed: {exc}"
            return False

    def _pending_row_to_dict(self, row: dict[str, Any]) -> dict[str, Any]:
        analysis = self._decode_json(row.get("analysis_json"), {})
        return {
            "event_uid": row["event_uid"],
            "event_id": int(row["event_id"]),
            "created_at": row["created_at"],
            "amount": float(row["amount"]),
            "tx_type": int(row["tx_type"]),
            "account_age_days": int(row["account_age_days"]),
            "mcc": str(row["mcc"]),
            "is_vpn": bool(row["is_vpn"]),
            "predicted_label": row.get("predicted_label") or (
                "heavy" if bool(row["is_heavy"]) else "light"
            ),
            "risk_score": int(round(float(row["risk_score"]))),
            "risk_level": row["risk_level"],
            "task_path": row["task_path"],
            "classifier_source": row["classifier_source"],
            "model_name": row["model_name"],
            "confidence": float(row.get("model_confidence") or 0.0),
            "review_reasons": self._decode_json(row.get("review_reason"), []),
            "risk_factors": analysis.get("factors", []),
            "analysis": analysis,
        }

    def list_pending_reviews(self, limit: int = 50) -> list[dict[str, Any]]:
        safe_limit = max(1, min(int(limit), 200))
        try:
            with self._lock, self.database.transaction() as connection:
                rows = connection.execute(
                    text(
                        """
                        SELECT * FROM transactions
                        WHERE review_status = 'pending'
                        ORDER BY record_id ASC
                        LIMIT :limit
                        """
                    ),
                    {"limit": safe_limit},
                ).mappings().all()
            self._last_error = None
            return [self._pending_row_to_dict(dict(row)) for row in rows]
        except SQLAlchemyError as exc:
            self._last_error = f"Database pending-review read failed: {exc}"
            return []

    def get_pending_review(self, event_uid: str) -> dict[str, Any] | None:
        try:
            with self._lock, self.database.transaction() as connection:
                row = connection.execute(
                    text(
                        "SELECT * FROM transactions WHERE event_uid = :event_uid AND review_status = 'pending'"
                    ),
                    {"event_uid": event_uid},
                ).mappings().first()
            self._last_error = None
            return self._pending_row_to_dict(dict(row)) if row else None
        except SQLAlchemyError as exc:
            self._last_error = f"Database pending-review lookup failed: {exc}"
            return None

    def resolve_pending_review(
        self,
        *,
        event_uid: str,
        reviewed_label: str,
        reviewed_by: str,
        routed_event: dict[str, Any],
    ) -> dict[str, Any] | None:
        now = self._now()
        try:
            with self._lock, self.database.transaction() as connection:
                row = connection.execute(
                    text(
                        "SELECT predicted_label FROM transactions "
                        "WHERE event_uid = :event_uid AND review_status = 'pending'"
                    ),
                    {"event_uid": event_uid},
                ).mappings().first()
                if row is None:
                    return None
                predicted_label = str(row["predicted_label"])
                prediction_correct = int(predicted_label == reviewed_label)
                connection.execute(
                    text(
                        """
                        UPDATE transactions
                        SET reviewed_label = :reviewed_label,
                            reviewed_at = :reviewed_at,
                            reviewed_by = :reviewed_by,
                            prediction_correct = :prediction_correct,
                            review_status = 'resolved',
                            routed_after_review = 1,
                            ai_route_node = :ai_route_node,
                            legacy_route_node = :legacy_route_node,
                            ai_latency_ms = :ai_latency_ms,
                            legacy_latency_ms = :legacy_latency_ms
                        WHERE event_uid = :event_uid AND review_status = 'pending'
                        """
                    ),
                    {
                        "reviewed_label": reviewed_label,
                        "reviewed_at": now,
                        "reviewed_by": reviewed_by,
                        "prediction_correct": prediction_correct,
                        "ai_route_node": routed_event["ai_route"]["node_id"],
                        "legacy_route_node": routed_event["legacy_route"]["node_id"],
                        "ai_latency_ms": routed_event["ai_route"]["estimated_latency_ms"],
                        "legacy_latency_ms": routed_event["legacy_route"]["estimated_latency_ms"],
                        "event_uid": event_uid,
                    },
                )
                self._refresh_counts(connection)
            self._last_error = None
            return {
                "reviewed_label": reviewed_label,
                "predicted_label": predicted_label,
                "prediction_correct": bool(prediction_correct),
                "reviewed_by": reviewed_by,
                "reviewed_at": now,
            }
        except SQLAlchemyError as exc:
            self._last_error = f"Database review resolution failed: {exc}"
            return None

    def add_feedback(
        self,
        event_uid: str,
        reviewed_label: str,
        reviewed_by: str = "operator",
    ) -> dict[str, Any] | None:
        now = self._now()
        try:
            with self._lock, self.database.transaction() as connection:
                row = connection.execute(
                    text(
                        """
                        SELECT predicted_label, is_heavy
                        FROM transactions
                        WHERE event_uid = :event_uid
                          AND source = 'manual'
                          AND review_status != 'pending'
                        """
                    ),
                    {"event_uid": event_uid},
                ).mappings().first()
                if row is None:
                    return None
                predicted_label = row["predicted_label"] or (
                    "heavy" if bool(row["is_heavy"]) else "light"
                )
                prediction_correct = int(predicted_label == reviewed_label)
                connection.execute(
                    text(
                        """
                        UPDATE transactions
                        SET reviewed_label = :reviewed_label,
                            reviewed_at = :reviewed_at,
                            reviewed_by = :reviewed_by,
                            prediction_correct = :prediction_correct,
                            review_status = 'resolved'
                        WHERE event_uid = :event_uid
                        """
                    ),
                    {
                        "reviewed_label": reviewed_label,
                        "reviewed_at": now,
                        "reviewed_by": reviewed_by,
                        "prediction_correct": prediction_correct,
                        "event_uid": event_uid,
                    },
                )
                self._refresh_counts(connection)
            self._last_error = None
            return {
                "reviewed_label": reviewed_label,
                "predicted_label": predicted_label,
                "prediction_correct": bool(prediction_correct),
                "reviewed_by": reviewed_by,
                "reviewed_at": now,
            }
        except SQLAlchemyError as exc:
            self._last_error = f"Database feedback write failed: {exc}"
            return None

    def reviewed_training_rows(self) -> list[dict[str, Any]]:
        try:
            with self._lock, self.database.transaction() as connection:
                rows = connection.execute(
                    text(
                        """
                        SELECT event_uid, amount, tx_type, account_age_days, mcc,
                               is_vpn, reviewed_label
                        FROM transactions
                        WHERE reviewed_label IN ('heavy', 'light')
                        ORDER BY record_id ASC
                        """
                    )
                ).mappings().all()
            self._last_error = None
            return [dict(row) for row in rows]
        except SQLAlchemyError as exc:
            self._last_error = f"Database training-row read failed: {exc}"
            return []

    @staticmethod
    def _parse_bool(value: Any, *, row_number: int) -> bool:
        normalized = str(value).strip().lower()
        if normalized in {"1", "true", "yes", "y"}:
            return True
        if normalized in {"0", "false", "no", "n"}:
            return False
        raise DatasetImportError(f"Row {row_number}: is_vpn must be true or false")

    @staticmethod
    def _optional_float(value: Any, default: float) -> float:
        text_value = str(value or "").strip()
        return float(text_value) if text_value else default

    def _parse_import_rows(self, csv_bytes: bytes, batch_id: str) -> list[dict[str, Any]]:
        try:
            decoded = csv_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise DatasetImportError("CSV must use UTF-8 encoding") from exc

        reader = csv.DictReader(io.StringIO(decoded))
        if reader.fieldnames is None:
            raise DatasetImportError("CSV header is missing")
        columns = {column.strip() for column in reader.fieldnames}
        missing = sorted(self.REQUIRED_IMPORT_COLUMNS - columns)
        if missing:
            raise DatasetImportError(f"CSV is missing required columns: {', '.join(missing)}")

        rows: list[dict[str, Any]] = []
        seen_event_uids: set[str] = set()
        for row_number, raw in enumerate(reader, start=2):
            if not any(str(value or "").strip() for value in raw.values()):
                continue
            try:
                event_uid = str(raw.get("event_uid") or "").strip()
                if not event_uid:
                    event_uid = f"IMPORT:{batch_id}:{row_number - 1:04d}"
                if event_uid in seen_event_uids:
                    raise DatasetImportError(f"Row {row_number}: duplicate event_uid inside CSV")
                seen_event_uids.add(event_uid)

                amount = float(raw["amount"])
                tx_type = int(raw["tx_type"])
                account_age_days = int(raw["account_age_days"])
                mcc = str(raw["mcc"]).strip()
                is_vpn = self._parse_bool(raw["is_vpn"], row_number=row_number)
                reviewed_label = str(raw["reviewed_label"]).strip().lower()
                if amount <= 0:
                    raise DatasetImportError(f"Row {row_number}: amount must be positive")
                if tx_type not in {0, 1, 2}:
                    raise DatasetImportError(f"Row {row_number}: tx_type must be 0, 1, or 2")
                if account_age_days < 0:
                    raise DatasetImportError(f"Row {row_number}: account_age_days cannot be negative")
                if len(mcc) != 4 or not mcc.isdigit():
                    raise DatasetImportError(f"Row {row_number}: mcc must contain four digits")
                if reviewed_label not in {"heavy", "light"}:
                    raise DatasetImportError(f"Row {row_number}: reviewed_label must be heavy or light")

                predicted_label = str(raw.get("predicted_label") or reviewed_label).strip().lower()
                if predicted_label not in {"heavy", "light"}:
                    raise DatasetImportError(f"Row {row_number}: predicted_label must be heavy or light")
                is_heavy = reviewed_label == "heavy"
                risk_score = self._optional_float(raw.get("risk_score"), 82.0 if is_heavy else 18.0)
                risk_level = str(raw.get("risk_level") or ("high" if is_heavy else "low")).strip().lower()
                if risk_level not in {"low", "medium", "high"}:
                    raise DatasetImportError(f"Row {row_number}: invalid risk_level")
                task_path = str(
                    raw.get("task_path")
                    or ("DEEP FRAUD CHECK" if is_heavy else "LIGHT FAST-PATH")
                ).strip()
                confidence = self._optional_float(raw.get("model_confidence"), 0.85)
                probability = self._optional_float(
                    raw.get("model_probability"),
                    0.82 if predicted_label == "heavy" else 0.18,
                )
                rows.append(
                    {
                        "event_uid": event_uid,
                        "amount": amount,
                        "tx_type": tx_type,
                        "account_age_days": account_age_days,
                        "mcc": mcc,
                        "is_vpn": is_vpn,
                        "reviewed_label": reviewed_label,
                        "predicted_label": predicted_label,
                        "risk_score": max(0.0, min(100.0, risk_score)),
                        "risk_level": risk_level,
                        "task_path": task_path,
                        "model_confidence": max(0.0, min(1.0, confidence)),
                        "model_probability": max(0.0, min(1.0, probability)),
                        "reviewed_by": str(raw.get("reviewed_by") or "pre-hackathon-team").strip(),
                        "reviewed_at": str(raw.get("reviewed_at") or self._now()).strip(),
                        "review_note": str(raw.get("review_note") or "Prepared human-reviewed demo row").strip(),
                    }
                )
            except DatasetImportError:
                raise
            except (TypeError, ValueError) as exc:
                raise DatasetImportError(f"Row {row_number}: invalid numeric value") from exc

        if not rows:
            raise DatasetImportError("CSV contains no transaction rows")
        if len(rows) > 5000:
            raise DatasetImportError("A single import is limited to 5000 rows")
        return rows

    def import_reviewed_csv(
        self,
        *,
        csv_bytes: bytes,
        batch_id: str,
        filename: str,
        imported_by: str,
        expected_start_reviewed: int | None = None,
        expected_end_reviewed: int | None = None,
        strict_sequence: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_batch = batch_id.strip()
        if not normalized_batch or len(normalized_batch) > 100:
            raise DatasetImportError("batch_id must contain 1 to 100 characters")
        rows = self._parse_import_rows(csv_bytes, normalized_batch)
        file_hash = hashlib.sha256(csv_bytes).hexdigest()
        now = self._now()

        try:
            with self._lock, self.database.transaction() as connection:
                existing = connection.execute(
                    text(
                        "SELECT batch_id, inserted_rows, imported_at FROM dataset_imports "
                        "WHERE batch_id = :batch_id OR file_sha256 = :file_hash"
                    ),
                    {"batch_id": normalized_batch, "file_hash": file_hash},
                ).mappings().first()
                if existing:
                    current_reviewed = int(
                        connection.execute(
                            text("SELECT COUNT(*) FROM transactions WHERE reviewed_label IN ('heavy', 'light')")
                        ).scalar_one()
                    )
                    return {
                        "status": "already_imported",
                        "batch_id": existing["batch_id"],
                        "received_rows": len(rows),
                        "inserted_rows": 0,
                        "duplicate_rows": len(rows),
                        "reviewed_rows": current_reviewed,
                        "imported_at": existing["imported_at"],
                    }

                current_reviewed = int(
                    connection.execute(
                        text("SELECT COUNT(*) FROM transactions WHERE reviewed_label IN ('heavy', 'light')")
                    ).scalar_one()
                )
                if strict_sequence and expected_start_reviewed is not None and current_reviewed != expected_start_reviewed:
                    raise DatasetImportError(
                        f"Batch {normalized_batch} expects {expected_start_reviewed} reviewed rows; "
                        f"the database currently has {current_reviewed}"
                    )

                inserted_rows = 0
                for index, row in enumerate(rows, start=1):
                    analysis = {
                        "risk_score": row["risk_score"],
                        "risk_level": row["risk_level"],
                        "task_path": row["task_path"],
                        "is_heavy": row["reviewed_label"] == "heavy",
                        "cpu_load_required": 15.0 if row["reviewed_label"] == "heavy" else 5.0,
                        "factors": [
                            {
                                "code": "prepared_review",
                                "label": "Pre-hackathon human review",
                                "points": 0,
                                "detail": row["review_note"],
                            }
                        ],
                        "classifier_source": "prepared_dataset",
                        "model_name": "PreparedReviewedDataset-v1",
                        "confidence": row["model_confidence"],
                        "model_probability": row["model_probability"],
                        "predicted_label": row["predicted_label"],
                        "review_required": False,
                        "review_reasons": [],
                        "api_used": False,
                        "fallback_reason": None,
                    }
                    result = connection.execute(
                        text(
                            """
                            INSERT INTO transactions (
                                event_uid, run_id, event_id, created_at, source,
                                amount, tx_type, account_age_days, mcc, is_vpn,
                                classifier_source, model_name, risk_score, risk_level,
                                is_heavy, task_path, review_status, review_reason,
                                predicted_label, model_probability, model_confidence,
                                analysis_json, reviewed_label, reviewed_at, reviewed_by,
                                prediction_correct, routed_after_review
                            ) VALUES (
                                :event_uid, 0, :event_id, :created_at, 'demo_import',
                                :amount, :tx_type, :account_age_days, :mcc, :is_vpn,
                                'prepared_dataset', 'PreparedReviewedDataset-v1',
                                :risk_score, :risk_level, :is_heavy, :task_path,
                                'resolved', :review_reason, :predicted_label,
                                :model_probability, :model_confidence, :analysis_json,
                                :reviewed_label, :reviewed_at, :reviewed_by,
                                :prediction_correct, 0
                            ) ON CONFLICT(event_uid) DO NOTHING
                            """
                        ),
                        {
                            "event_uid": row["event_uid"],
                            "event_id": index,
                            "created_at": now,
                            "amount": row["amount"],
                            "tx_type": row["tx_type"],
                            "account_age_days": row["account_age_days"],
                            "mcc": row["mcc"],
                            "is_vpn": int(row["is_vpn"]),
                            "risk_score": row["risk_score"],
                            "risk_level": row["risk_level"],
                            "is_heavy": int(row["reviewed_label"] == "heavy"),
                            "task_path": row["task_path"],
                            "review_reason": json.dumps([row["review_note"]], ensure_ascii=True),
                            "predicted_label": row["predicted_label"],
                            "model_probability": row["model_probability"],
                            "model_confidence": row["model_confidence"],
                            "analysis_json": self._analysis_json(analysis),
                            "reviewed_label": row["reviewed_label"],
                            "reviewed_at": row["reviewed_at"],
                            "reviewed_by": row["reviewed_by"] or imported_by,
                            "prediction_correct": int(row["predicted_label"] == row["reviewed_label"]),
                        },
                    )
                    inserted_rows += max(0, int(result.rowcount or 0))

                resulting_reviewed = int(
                    connection.execute(
                        text("SELECT COUNT(*) FROM transactions WHERE reviewed_label IN ('heavy', 'light')")
                    ).scalar_one()
                )
                if strict_sequence and expected_end_reviewed is not None and resulting_reviewed != expected_end_reviewed:
                    raise DatasetImportError(
                        f"Batch {normalized_batch} should finish at {expected_end_reviewed} reviewed rows; "
                        f"it would finish at {resulting_reviewed}. The import was rolled back."
                    )

                duplicate_rows = len(rows) - inserted_rows
                connection.execute(
                    text(
                        """
                        INSERT INTO dataset_imports (
                            batch_id, filename, file_sha256,
                            expected_start_reviewed, expected_end_reviewed,
                            received_rows, inserted_rows, duplicate_rows,
                            imported_by, imported_at, metadata_json
                        ) VALUES (
                            :batch_id, :filename, :file_sha256,
                            :expected_start_reviewed, :expected_end_reviewed,
                            :received_rows, :inserted_rows, :duplicate_rows,
                            :imported_by, :imported_at, :metadata_json
                        )
                        """
                    ),
                    {
                        "batch_id": normalized_batch,
                        "filename": filename,
                        "file_sha256": file_hash,
                        "expected_start_reviewed": expected_start_reviewed,
                        "expected_end_reviewed": expected_end_reviewed,
                        "received_rows": len(rows),
                        "inserted_rows": inserted_rows,
                        "duplicate_rows": duplicate_rows,
                        "imported_by": imported_by,
                        "imported_at": now,
                        "metadata_json": json.dumps(metadata or {}, ensure_ascii=True),
                    },
                )
                self._trim(connection)
                self._refresh_counts(connection)

            self._last_error = None
            return {
                "status": "success",
                "batch_id": normalized_batch,
                "filename": filename,
                "received_rows": len(rows),
                "inserted_rows": inserted_rows,
                "duplicate_rows": duplicate_rows,
                "reviewed_rows": self._reviewed_count,
                "imported_at": now,
            }
        except DatasetImportError:
            raise
        except SQLAlchemyError as exc:
            self._last_error = f"Dataset import failed: {exc}"
            raise DatasetImportError("Database rejected the dataset import") from exc

    def list_dataset_imports(self, limit: int = 20) -> list[dict[str, Any]]:
        try:
            with self.database.transaction() as connection:
                rows = connection.execute(
                    text(
                        """
                        SELECT batch_id, filename, expected_start_reviewed,
                               expected_end_reviewed, received_rows, inserted_rows,
                               duplicate_rows, imported_by, imported_at, metadata_json
                        FROM dataset_imports
                        ORDER BY import_id DESC
                        LIMIT :limit
                        """
                    ),
                    {"limit": max(1, min(limit, 100))},
                ).mappings().all()
            return [
                {
                    **{key: value for key, value in dict(row).items() if key != "metadata_json"},
                    "metadata": self._decode_json(row["metadata_json"], {}),
                }
                for row in rows
            ]
        except SQLAlchemyError as exc:
            self._last_error = f"Dataset import history read failed: {exc}"
            return []

    def get_retraining_state(self) -> dict[str, Any]:
        try:
            with self.database.transaction() as connection:
                row = connection.execute(
                    text("SELECT * FROM retraining_state WHERE state_id = 1")
                ).mappings().one()
            return {
                "last_attempted_reviewed_rows": int(row["last_attempted_reviewed_rows"]),
                "last_promoted_reviewed_rows": int(row["last_promoted_reviewed_rows"]),
                "promotions": int(row["promotions"]),
                "last_started_at": row["last_started_at"],
                "last_completed_at": row["last_completed_at"],
                "last_error": row["last_error"],
                "last_result": self._decode_json(row["last_result_json"], None),
            }
        except SQLAlchemyError as exc:
            self._last_error = f"Retraining state read failed: {exc}"
            return {
                "last_attempted_reviewed_rows": 0,
                "last_promoted_reviewed_rows": 0,
                "promotions": 0,
                "last_started_at": None,
                "last_completed_at": None,
                "last_error": None,
                "last_result": None,
            }

    def save_retraining_state(self, state: dict[str, Any]) -> None:
        with self.database.transaction() as connection:
            connection.execute(
                text(
                    """
                    UPDATE retraining_state
                    SET last_attempted_reviewed_rows = :last_attempted,
                        last_promoted_reviewed_rows = :last_promoted,
                        promotions = :promotions,
                        last_started_at = :last_started_at,
                        last_completed_at = :last_completed_at,
                        last_error = :last_error,
                        last_result_json = :last_result_json,
                        updated_at = :updated_at
                    WHERE state_id = 1
                    """
                ),
                {
                    "last_attempted": int(state.get("last_attempted_reviewed_rows", 0)),
                    "last_promoted": int(state.get("last_promoted_reviewed_rows", 0)),
                    "promotions": int(state.get("promotions", 0)),
                    "last_started_at": state.get("last_started_at"),
                    "last_completed_at": state.get("last_completed_at"),
                    "last_error": state.get("last_error"),
                    "last_result_json": json.dumps(state.get("last_result"), ensure_ascii=True)
                    if state.get("last_result") is not None
                    else None,
                    "updated_at": self._now(),
                },
            )

    def add_retraining_run(self, result: dict[str, Any]) -> None:
        metrics = result.get("metrics") or {}
        with self.database.transaction() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO retraining_runs (
                        reviewed_rows, heavy_rows, light_rows, selected_algorithm,
                        model_name, metrics_json, candidate_metrics_json,
                        quality_passed, promoted, error, started_at, completed_at
                    ) VALUES (
                        :reviewed_rows, :heavy_rows, :light_rows, :selected_algorithm,
                        :model_name, :metrics_json, :candidate_metrics_json,
                        :quality_passed, :promoted, :error, :started_at, :completed_at
                    )
                    """
                ),
                {
                    "reviewed_rows": int(result.get("reviewed_rows", 0)),
                    "heavy_rows": int(result.get("heavy_rows", 0)),
                    "light_rows": int(result.get("light_rows", 0)),
                    "selected_algorithm": result.get("selected_algorithm"),
                    "model_name": result.get("model_name"),
                    "metrics_json": json.dumps(metrics, ensure_ascii=True),
                    "candidate_metrics_json": json.dumps(
                        result.get("candidate_metrics") or {}, ensure_ascii=True
                    ),
                    "quality_passed": int(bool(result.get("quality_passed", False))),
                    "promoted": int(bool(result.get("promoted", False))),
                    "error": result.get("error"),
                    "started_at": result.get("started_at") or self._now(),
                    "completed_at": result.get("completed_at") or self._now(),
                },
            )

    def list_retraining_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        try:
            with self.database.transaction() as connection:
                rows = connection.execute(
                    text(
                        """
                        SELECT run_id, reviewed_rows, heavy_rows, light_rows,
                               selected_algorithm, model_name, metrics_json,
                               candidate_metrics_json, quality_passed, promoted,
                               error, started_at, completed_at
                        FROM retraining_runs
                        ORDER BY run_id DESC
                        LIMIT :limit
                        """
                    ),
                    {"limit": max(1, min(limit, 100))},
                ).mappings().all()
            return [
                {
                    "run_id": int(row["run_id"]),
                    "reviewed_rows": int(row["reviewed_rows"]),
                    "heavy_rows": int(row["heavy_rows"]),
                    "light_rows": int(row["light_rows"]),
                    "selected_algorithm": row["selected_algorithm"],
                    "model_name": row["model_name"],
                    "metrics": self._decode_json(row["metrics_json"], {}),
                    "candidate_metrics": self._decode_json(row["candidate_metrics_json"], {}),
                    "quality_passed": bool(row["quality_passed"]),
                    "promoted": bool(row["promoted"]),
                    "error": row["error"],
                    "started_at": row["started_at"],
                    "completed_at": row["completed_at"],
                }
                for row in rows
            ]
        except SQLAlchemyError as exc:
            self._last_error = f"Retraining history read failed: {exc}"
            return []

    def save_model_artifact(
        self,
        *,
        model_version: str,
        selected_algorithm: str,
        artifact_bytes: bytes,
        metrics: dict[str, Any],
        reviewed_rows: int,
    ) -> None:
        with self.database.transaction() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO model_artifacts (
                        model_version, selected_algorithm, artifact_bytes,
                        metrics_json, reviewed_rows, promoted_at
                    ) VALUES (
                        :model_version, :selected_algorithm, :artifact_bytes,
                        :metrics_json, :reviewed_rows, :promoted_at
                    )
                    """
                ),
                {
                    "model_version": model_version,
                    "selected_algorithm": selected_algorithm,
                    "artifact_bytes": artifact_bytes,
                    "metrics_json": json.dumps(metrics, ensure_ascii=True),
                    "reviewed_rows": reviewed_rows,
                    "promoted_at": self._now(),
                },
            )

    def latest_model_artifact(self) -> dict[str, Any] | None:
        try:
            with self.database.transaction() as connection:
                row = connection.execute(
                    text(
                        """
                        SELECT model_version, selected_algorithm, artifact_bytes,
                               metrics_json, reviewed_rows, promoted_at
                        FROM model_artifacts
                        ORDER BY artifact_id DESC
                        LIMIT 1
                        """
                    )
                ).mappings().first()
            if not row:
                return None
            return {
                "model_version": row["model_version"],
                "selected_algorithm": row["selected_algorithm"],
                "artifact_bytes": bytes(row["artifact_bytes"]),
                "metrics": self._decode_json(row["metrics_json"], {}),
                "reviewed_rows": int(row["reviewed_rows"]),
                "promoted_at": row["promoted_at"],
            }
        except SQLAlchemyError as exc:
            self._last_error = f"Model artifact read failed: {exc}"
            return None

    def reset_learning_demo(self) -> dict[str, Any]:
        """Clear reviewed evidence, import history, retraining history, and models.

        This is intentionally separate from the ordinary simulation reset. It is
        operator-only at the API layer and exists so the team can rehearse the
        0 -> 99 -> 100 -> 200 -> 300 judge flow more than once.
        """

        with self._lock, self.database.transaction() as connection:
            if self.database.is_postgresql:
                connection.execute(
                    text(
                        "TRUNCATE TABLE transactions, dataset_imports, "
                        "retraining_runs, model_artifacts RESTART IDENTITY"
                    )
                )
            else:
                for table in (
                    "transactions",
                    "dataset_imports",
                    "retraining_runs",
                    "model_artifacts",
                ):
                    connection.execute(text(f"DELETE FROM {table}"))
                connection.execute(
                    text(
                        "DELETE FROM sqlite_sequence "
                        "WHERE name IN ('transactions', 'dataset_imports', "
                        "'retraining_runs', 'model_artifacts')"
                    )
                )

            connection.execute(
                text(
                    """
                    UPDATE retraining_state
                    SET last_attempted_reviewed_rows = 0,
                        last_promoted_reviewed_rows = 0,
                        promotions = 0,
                        last_started_at = NULL,
                        last_completed_at = NULL,
                        last_error = NULL,
                        last_result_json = NULL,
                        updated_at = :updated_at
                    WHERE state_id = 1
                    """
                ),
                {"updated_at": self._now()},
            )
            self._refresh_counts(connection)

        self._last_error = None
        return self.stats()

    def export_csv(self) -> str:
        columns = [
            "event_uid", "run_id", "event_id", "created_at", "source",
            "amount", "tx_type", "account_age_days", "mcc", "is_vpn",
            "classifier_source", "model_name", "risk_score", "risk_level",
            "is_heavy", "task_path", "ai_route_node", "legacy_route_node",
            "ai_latency_ms", "legacy_latency_ms", "review_status", "review_reason",
            "predicted_label", "model_probability", "model_confidence",
            "reviewed_label", "reviewed_at", "reviewed_by",
            "prediction_correct", "routed_after_review",
        ]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(columns)
        with self._lock, self.database.transaction() as connection:
            rows = connection.execute(
                text(f"SELECT {', '.join(columns)} FROM transactions ORDER BY record_id ASC")
            ).mappings().all()
            for row in rows:
                writer.writerow([row[column] for column in columns])
        return output.getvalue()

    def stats(self) -> dict[str, Any]:
        reviewed_accuracy = None
        reviewed_total = self._correct_count + self._incorrect_count
        if reviewed_total:
            reviewed_accuracy = round(self._correct_count / reviewed_total, 4)
        return {
            "rows": self._row_count,
            "reviewed_rows": self._reviewed_count,
            "pending_reviews": self._pending_count,
            "correct_predictions": self._correct_count,
            "incorrect_predictions": self._incorrect_count,
            "reviewed_accuracy": reviewed_accuracy,
            "max_rows": self.max_rows,
            "auto_sample_every": self.auto_sample_every,
            "storage": self.database.storage_name,
            "persistent": self.database.storage_name == "postgresql",
            "contains_sensitive_identifiers": False,
            "last_error": self._last_error,
        }


transaction_store = TransactionDatasetStore()
