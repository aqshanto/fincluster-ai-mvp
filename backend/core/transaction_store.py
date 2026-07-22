from __future__ import annotations

import csv
import io
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class TransactionDatasetStore:
    """Privacy-aware transaction and human-review store.

    Raw IP addresses, device IDs, terminal IDs, STANs, and RRNs are deliberately
    excluded. Pending reviews retain only the features required to classify and
    route the simulated workload.
    """

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

    def __init__(self) -> None:
        default_path = Path(__file__).resolve().parents[1] / "data" / "transactions.db"
        self.path = Path(os.getenv("AI_DATASET_PATH", str(default_path)))
        self.max_rows = max(100, int(os.getenv("AI_DATASET_MAX_ROWS", "10000")))
        self.auto_sample_every = max(1, int(os.getenv("AUTO_DATA_SAMPLE_EVERY", "25")))
        self._lock = threading.RLock()
        self._row_count = 0
        self._reviewed_count = 0
        self._pending_count = 0
        self._correct_count = 0
        self._incorrect_count = 0
        self._last_error: str | None = None
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._connection() as connection:
                connection.execute("PRAGMA journal_mode=WAL")
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS transactions (
                        record_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                self._ensure_migration_columns(connection)
                self._refresh_counts(connection)
            self._last_error = None
        except sqlite3.Error as exc:
            self._last_error = f"SQLite initialization failed: {exc}"

    def _ensure_migration_columns(self, connection: sqlite3.Connection) -> None:
        existing = {
            str(row["name"])
            for row in connection.execute("PRAGMA table_info(transactions)").fetchall()
        }
        for name, definition in self._MIGRATION_COLUMNS.items():
            if name not in existing:
                connection.execute(f"ALTER TABLE transactions ADD COLUMN {name} {definition}")

    def _refresh_counts(self, connection: sqlite3.Connection) -> None:
        self._row_count = int(connection.execute("SELECT COUNT(*) FROM transactions").fetchone()[0])
        self._reviewed_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM transactions WHERE reviewed_label IN ('heavy', 'light')"
            ).fetchone()[0]
        )
        self._pending_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM transactions WHERE review_status = 'pending'"
            ).fetchone()[0]
        )
        self._correct_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM transactions WHERE prediction_correct = 1"
            ).fetchone()[0]
        )
        self._incorrect_count = int(
            connection.execute(
                "SELECT COUNT(*) FROM transactions WHERE prediction_correct = 0"
            ).fetchone()[0]
        )

    def _trim(self, connection: sqlite3.Connection) -> None:
        overflow = int(
            connection.execute(
                "SELECT MAX(0, COUNT(*) - ?) FROM transactions", (self.max_rows,)
            ).fetchone()[0]
        )
        if not overflow:
            return

        # Keep unresolved reviews whenever possible. Old resolved/not-required rows
        # are removed first when the local dataset reaches its configured cap.
        connection.execute(
            """
            DELETE FROM transactions
            WHERE record_id IN (
                SELECT record_id
                FROM transactions
                WHERE review_status != 'pending'
                ORDER BY record_id ASC
                LIMIT ?
            )
            """,
            (overflow,),
        )

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

    @staticmethod
    def _decode_json(value: str | None, fallback: Any) -> Any:
        if not value:
            return fallback
        try:
            return json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return fallback

    def should_record(self, source: str, event_id: int) -> bool:
        return source == "manual" or event_id % self.auto_sample_every == 0

    def record(self, *, event: dict[str, Any], task: dict[str, Any], analysis: dict[str, Any]) -> bool:
        if not self.should_record(event["source"], int(event["event_id"])):
            return False

        run_id_text, _ = str(event["event_uid"]).split(":", 1)
        predicted_label = str(
            analysis.get("predicted_label", "heavy" if analysis["is_heavy"] else "light")
        )
        row = (
            str(event["event_uid"]),
            int(run_id_text),
            int(event["event_id"]),
            datetime.now(timezone.utc).isoformat(),
            event["source"],
            float(task["amount"]),
            int(task["tx_type"]),
            int(task["account_age_days"]),
            str(task.get("mcc", "5411")),
            int(bool(task.get("is_vpn", False))),
            str(analysis.get("classifier_source", "unknown")),
            str(analysis.get("model_name", "unknown")),
            float(analysis["risk_score"]),
            str(analysis["risk_level"]),
            int(bool(analysis["is_heavy"])),
            str(analysis["task_path"]),
            event["ai_route"]["node_id"],
            event["legacy_route"]["node_id"],
            event["ai_route"]["estimated_latency_ms"],
            event["legacy_route"]["estimated_latency_ms"],
            "feedback_optional" if event["source"] == "manual" else "not_required",
            predicted_label,
            analysis.get("model_probability"),
            float(analysis.get("confidence", 0.0)),
            self._analysis_json(analysis),
        )

        try:
            with self._lock, self._connection() as connection:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO transactions (
                        event_uid, run_id, event_id, created_at, source, amount,
                        tx_type, account_age_days, mcc, is_vpn,
                        classifier_source, model_name, risk_score, risk_level,
                        is_heavy, task_path, ai_route_node, legacy_route_node,
                        ai_latency_ms, legacy_latency_ms, review_status,
                        predicted_label, model_probability, model_confidence,
                        analysis_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    row,
                )
                self._trim(connection)
                self._refresh_counts(connection)
            self._last_error = None
            return True
        except (sqlite3.Error, ValueError) as exc:
            self._last_error = f"SQLite write failed: {exc}"
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
        row = (
            event_uid,
            int(run_id_text),
            int(event_id),
            datetime.now(timezone.utc).isoformat(),
            "manual",
            float(task["amount"]),
            int(task["tx_type"]),
            int(task["account_age_days"]),
            str(task.get("mcc", "5411")),
            int(bool(task.get("is_vpn", False))),
            str(analysis.get("classifier_source", "unknown")),
            str(analysis.get("model_name", "unknown")),
            float(analysis["risk_score"]),
            str(analysis["risk_level"]),
            int(bool(analysis["is_heavy"])),
            str(analysis["task_path"]),
            "pending",
            json.dumps(reasons, ensure_ascii=True),
            predicted_label,
            analysis.get("model_probability"),
            float(analysis.get("confidence", 0.0)),
            self._analysis_json(analysis),
        )

        try:
            with self._lock, self._connection() as connection:
                connection.execute(
                    """
                    INSERT OR REPLACE INTO transactions (
                        event_uid, run_id, event_id, created_at, source, amount,
                        tx_type, account_age_days, mcc, is_vpn,
                        classifier_source, model_name, risk_score, risk_level,
                        is_heavy, task_path, review_status, review_reason,
                        predicted_label, model_probability, model_confidence,
                        analysis_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    row,
                )
                self._trim(connection)
                self._refresh_counts(connection)
            self._last_error = None
            return True
        except (sqlite3.Error, ValueError) as exc:
            self._last_error = f"SQLite pending-review write failed: {exc}"
            return False

    def _pending_row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        analysis = self._decode_json(row["analysis_json"], {})
        return {
            "event_uid": row["event_uid"],
            "event_id": int(row["event_id"]),
            "created_at": row["created_at"],
            "amount": float(row["amount"]),
            "tx_type": int(row["tx_type"]),
            "account_age_days": int(row["account_age_days"]),
            "mcc": str(row["mcc"]),
            "is_vpn": bool(row["is_vpn"]),
            "predicted_label": row["predicted_label"] or (
                "heavy" if bool(row["is_heavy"]) else "light"
            ),
            "risk_score": int(round(float(row["risk_score"]))),
            "risk_level": row["risk_level"],
            "task_path": row["task_path"],
            "classifier_source": row["classifier_source"],
            "model_name": row["model_name"],
            "confidence": float(row["model_confidence"] or 0.0),
            "review_reasons": self._decode_json(row["review_reason"], []),
            "risk_factors": analysis.get("factors", []),
            "analysis": analysis,
        }

    def list_pending_reviews(self, limit: int = 50) -> list[dict[str, Any]]:
        safe_limit = max(1, min(int(limit), 200))
        try:
            with self._lock, self._connection() as connection:
                rows = connection.execute(
                    """
                    SELECT * FROM transactions
                    WHERE review_status = 'pending'
                    ORDER BY record_id ASC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()
            self._last_error = None
            return [self._pending_row_to_dict(row) for row in rows]
        except sqlite3.Error as exc:
            self._last_error = f"SQLite pending-review read failed: {exc}"
            return []

    def get_pending_review(self, event_uid: str) -> dict[str, Any] | None:
        try:
            with self._lock, self._connection() as connection:
                row = connection.execute(
                    """
                    SELECT * FROM transactions
                    WHERE event_uid = ? AND review_status = 'pending'
                    """,
                    (event_uid,),
                ).fetchone()
            self._last_error = None
            return self._pending_row_to_dict(row) if row else None
        except sqlite3.Error as exc:
            self._last_error = f"SQLite pending-review lookup failed: {exc}"
            return None

    def resolve_pending_review(
        self,
        *,
        event_uid: str,
        reviewed_label: str,
        reviewed_by: str,
        routed_event: dict[str, Any],
    ) -> dict[str, Any] | None:
        now = datetime.now(timezone.utc).isoformat()
        try:
            with self._lock, self._connection() as connection:
                row = connection.execute(
                    "SELECT predicted_label FROM transactions WHERE event_uid = ? AND review_status = 'pending'",
                    (event_uid,),
                ).fetchone()
                if row is None:
                    return None
                predicted_label = str(row["predicted_label"])
                prediction_correct = int(predicted_label == reviewed_label)
                connection.execute(
                    """
                    UPDATE transactions
                    SET reviewed_label = ?, reviewed_at = ?, reviewed_by = ?,
                        prediction_correct = ?, review_status = 'resolved',
                        routed_after_review = 1,
                        ai_route_node = ?, legacy_route_node = ?,
                        ai_latency_ms = ?, legacy_latency_ms = ?
                    WHERE event_uid = ? AND review_status = 'pending'
                    """,
                    (
                        reviewed_label,
                        now,
                        reviewed_by,
                        prediction_correct,
                        routed_event["ai_route"]["node_id"],
                        routed_event["legacy_route"]["node_id"],
                        routed_event["ai_route"]["estimated_latency_ms"],
                        routed_event["legacy_route"]["estimated_latency_ms"],
                        event_uid,
                    ),
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
        except sqlite3.Error as exc:
            self._last_error = f"SQLite review resolution failed: {exc}"
            return None

    def add_feedback(
        self,
        event_uid: str,
        reviewed_label: str,
        reviewed_by: str = "operator",
    ) -> dict[str, Any] | None:
        now = datetime.now(timezone.utc).isoformat()
        try:
            with self._lock, self._connection() as connection:
                row = connection.execute(
                    """
                    SELECT predicted_label, is_heavy
                    FROM transactions
                    WHERE event_uid = ? AND source = 'manual' AND review_status != 'pending'
                    """,
                    (event_uid,),
                ).fetchone()
                if row is None:
                    return None
                predicted_label = row["predicted_label"] or (
                    "heavy" if bool(row["is_heavy"]) else "light"
                )
                prediction_correct = int(predicted_label == reviewed_label)
                connection.execute(
                    """
                    UPDATE transactions
                    SET reviewed_label = ?, reviewed_at = ?, reviewed_by = ?,
                        prediction_correct = ?, review_status = 'resolved'
                    WHERE event_uid = ?
                    """,
                    (reviewed_label, now, reviewed_by, prediction_correct, event_uid),
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
        except sqlite3.Error as exc:
            self._last_error = f"SQLite feedback write failed: {exc}"
            return None

    def reviewed_training_rows(self) -> list[dict[str, Any]]:
        try:
            with self._lock, self._connection() as connection:
                rows = connection.execute(
                    """
                    SELECT event_uid, amount, tx_type, account_age_days, mcc,
                           is_vpn, reviewed_label
                    FROM transactions
                    WHERE reviewed_label IN ('heavy', 'light')
                    ORDER BY record_id ASC
                    """
                ).fetchall()
            self._last_error = None
            return [dict(row) for row in rows]
        except sqlite3.Error as exc:
            self._last_error = f"SQLite training-row read failed: {exc}"
            return []

    def export_csv(self) -> str:
        columns = [
            "event_uid",
            "run_id",
            "event_id",
            "created_at",
            "source",
            "amount",
            "tx_type",
            "account_age_days",
            "mcc",
            "is_vpn",
            "classifier_source",
            "model_name",
            "risk_score",
            "risk_level",
            "is_heavy",
            "task_path",
            "ai_route_node",
            "legacy_route_node",
            "ai_latency_ms",
            "legacy_latency_ms",
            "review_status",
            "review_reason",
            "predicted_label",
            "model_probability",
            "model_confidence",
            "reviewed_label",
            "reviewed_at",
            "reviewed_by",
            "prediction_correct",
            "routed_after_review",
        ]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(columns)
        with self._lock, self._connection() as connection:
            rows = connection.execute(
                f"SELECT {', '.join(columns)} FROM transactions ORDER BY record_id ASC"
            ).fetchall()
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
            "storage": "sqlite",
            "contains_sensitive_identifiers": False,
            "last_error": self._last_error,
        }


transaction_store = TransactionDatasetStore()
