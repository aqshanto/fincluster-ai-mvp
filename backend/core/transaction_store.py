from __future__ import annotations

import csv
import io
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class TransactionDatasetStore:
    """Privacy-aware dataset collector for future supervised training.

    Raw IP addresses, device IDs, terminal IDs, STANs, and RRNs are deliberately
    excluded. Manual classifications can later receive a human-reviewed label.
    """

    def __init__(self) -> None:
        default_path = Path(__file__).resolve().parents[1] / "data" / "transactions.db"
        self.path = Path(os.getenv("AI_DATASET_PATH", str(default_path)))
        self.max_rows = max(100, int(os.getenv("AI_DATASET_MAX_ROWS", "10000")))
        self.auto_sample_every = max(1, int(os.getenv("AUTO_DATA_SAMPLE_EVERY", "25")))
        self._lock = threading.Lock()
        self._row_count = 0
        self._reviewed_count = 0
        self._last_error: str | None = None
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=3)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as connection:
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
                        reviewed_label TEXT,
                        reviewed_at TEXT
                    )
                    """
                )
                self._refresh_counts(connection)
        except sqlite3.Error as exc:
            self._last_error = f"SQLite initialization failed: {exc}"

    def _refresh_counts(self, connection: sqlite3.Connection) -> None:
        self._row_count = int(connection.execute("SELECT COUNT(*) FROM transactions").fetchone()[0])
        self._reviewed_count = int(
            connection.execute("SELECT COUNT(*) FROM transactions WHERE reviewed_label IS NOT NULL").fetchone()[0]
        )

    def should_record(self, source: str, event_id: int) -> bool:
        return source == "manual" or event_id % self.auto_sample_every == 0

    def record(self, *, event: dict[str, Any], task: dict[str, Any], analysis: dict[str, Any]) -> bool:
        if not self.should_record(event["source"], int(event["event_id"])):
            return False

        run_id_text, _ = str(event["event_uid"]).split(":", 1)
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
        )

        try:
            with self._lock, self._connect() as connection:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO transactions (
                        event_uid, run_id, event_id, created_at, source, amount,
                        tx_type, account_age_days, mcc, is_vpn,
                        classifier_source, model_name, risk_score, risk_level,
                        is_heavy, task_path, ai_route_node, legacy_route_node,
                        ai_latency_ms, legacy_latency_ms
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    row,
                )
                overflow = int(connection.execute("SELECT MAX(0, COUNT(*) - ?) FROM transactions", (self.max_rows,)).fetchone()[0])
                if overflow:
                    connection.execute(
                        "DELETE FROM transactions WHERE record_id IN (SELECT record_id FROM transactions ORDER BY record_id ASC LIMIT ?)",
                        (overflow,),
                    )
                self._refresh_counts(connection)
            self._last_error = None
            return True
        except (sqlite3.Error, ValueError) as exc:
            self._last_error = f"SQLite write failed: {exc}"
            return False

    def add_feedback(self, event_uid: str, reviewed_label: str) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        try:
            with self._lock, self._connect() as connection:
                cursor = connection.execute(
                    """
                    UPDATE transactions
                    SET reviewed_label = ?, reviewed_at = ?
                    WHERE event_uid = ? AND source = 'manual'
                    """,
                    (reviewed_label, now, event_uid),
                )
                if cursor.rowcount == 0:
                    return False
                self._refresh_counts(connection)
            self._last_error = None
            return True
        except sqlite3.Error as exc:
            self._last_error = f"SQLite feedback write failed: {exc}"
            return False

    def export_csv(self) -> str:
        columns = [
            "event_uid", "run_id", "event_id", "created_at", "source",
            "amount", "tx_type", "account_age_days", "mcc", "is_vpn",
            "classifier_source", "model_name", "risk_score", "risk_level",
            "is_heavy", "task_path", "ai_route_node", "legacy_route_node",
            "ai_latency_ms", "legacy_latency_ms", "reviewed_label", "reviewed_at",
        ]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(columns)
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                f"SELECT {', '.join(columns)} FROM transactions ORDER BY record_id ASC"
            ).fetchall()
            for row in rows:
                writer.writerow([row[column] for column in columns])
        return output.getvalue()

    def stats(self) -> dict[str, Any]:
        return {
            "rows": self._row_count,
            "reviewed_rows": self._reviewed_count,
            "max_rows": self.max_rows,
            "auto_sample_every": self.auto_sample_every,
            "storage": "sqlite",
            "contains_sensitive_identifiers": False,
            "last_error": self._last_error,
        }


transaction_store = TransactionDatasetStore()
