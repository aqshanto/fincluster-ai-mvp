from __future__ import annotations

import argparse
import asyncio
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Safely smoke-test FinCluster controlled retraining with an isolated "
            "temporary SQLite dataset and model artifact."
        )
    )
    parser.add_argument(
        "--keep-files",
        action="store_true",
        help="Keep the temporary database and model artifact after the test.",
    )
    return parser.parse_args()


def configure_test_environment(backend_dir: Path) -> tuple[Path, Path]:
    load_dotenv(backend_dir / ".env", override=False)

    database_path = backend_dir / "data" / "retraining_test.db"
    artifact_path = backend_dir / "models" / "retraining_test_classifier.joblib"

    os.environ["AI_DATASET_PATH"] = str(database_path)
    os.environ["AI_DATASET_MAX_ROWS"] = "1000"
    os.environ["AUTO_RETRAIN_ENABLED"] = "true"
    os.environ["AUTO_RETRAIN_MIN_REVIEWED"] = "100"
    os.environ["AUTO_RETRAIN_BATCH_SIZE"] = "25"
    os.environ["AUTO_RETRAIN_ALGORITHM"] = "auto"
    os.environ["AUTO_RETRAIN_MODEL_PATH"] = str(artifact_path)
    os.environ["LOCAL_MODEL_PATH"] = ""
    os.environ["LOCAL_MODEL_ALGORITHM"] = "auto"

    return database_path, artifact_path


def remove_sqlite_files(database_path: Path) -> None:
    for path in (
        database_path,
        Path(f"{database_path}-wal"),
        Path(f"{database_path}-shm"),
    ):
        path.unlink(missing_ok=True)


def build_row(index: int, label: str) -> tuple[object, ...]:
    is_heavy = label == "heavy"

    if is_heavy:
        amount = float(22_000 + (index % 40) * 1_750)
        tx_type = 1 if index % 3 else 2
        account_age_days = 2 + (index % 25)
        mcc = "7995" if index % 2 else "6011"
        is_vpn = 1 if index % 4 else 0
        probability = min(0.97, 0.72 + (index % 18) / 100)
        risk_level = "high"
        task_path = "DEEP FRAUD CHECK"
    else:
        amount = float(150 + (index % 45) * 95)
        tx_type = 0 if index % 3 else 2
        account_age_days = 180 + (index % 900)
        mcc = "5411" if index % 2 else "4814"
        is_vpn = 0
        probability = max(0.03, 0.28 - (index % 18) / 100)
        risk_level = "low"
        task_path = "LIGHT FAST-PATH"

    predicted_label = label if index % 10 else ("light" if is_heavy else "heavy")
    prediction_correct = int(predicted_label == label)
    now = datetime.now(timezone.utc).isoformat()

    return (
        f"test:{index}",
        999,
        index,
        now,
        "manual",
        amount,
        tx_type,
        account_age_days,
        mcc,
        is_vpn,
        "controlled_retraining_test",
        "temporary-test-model",
        probability * 100,
        risk_level,
        int(is_heavy),
        task_path,
        "resolved",
        predicted_label,
        probability,
        abs(probability - 0.5) * 2,
        label,
        now,
        "test-generator",
        prediction_correct,
        1,
    )


def insert_reviewed_rows(database_path: Path, *, start: int, count: int) -> None:
    rows = []
    for offset in range(count):
        index = start + offset
        label = "heavy" if index % 2 else "light"
        rows.append(build_row(index, label))

    with sqlite3.connect(database_path) as connection:
        connection.executemany(
            """
            INSERT OR REPLACE INTO transactions (
                event_uid, run_id, event_id, created_at, source, amount,
                tx_type, account_age_days, mcc, is_vpn,
                classifier_source, model_name, risk_score, risk_level,
                is_heavy, task_path, review_status, predicted_label,
                model_probability, model_confidence, reviewed_label,
                reviewed_at, reviewed_by, prediction_correct,
                routed_after_review
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        connection.commit()


def print_phase(title: str, status: dict[str, object]) -> None:
    print(f"\n=== {title} ===")
    print(json.dumps(status, indent=2, default=str))


async def run_test(database_path: Path, artifact_path: Path) -> None:
    # These imports must happen only after test-specific environment variables
    # are set, because each module creates global runtime objects at import time.
    from core.transaction_store import transaction_store
    from ml.local_model import local_model
    from ml.retraining_manager import retraining_manager

    insert_reviewed_rows(database_path, start=1, count=120)
    transaction_store._initialize()  # Refresh cached counters for this test store.

    first = await retraining_manager.maybe_retrain()
    print_phase("Initial 120-row retraining", first)

    if first["promotions"] != 1 or not artifact_path.exists():
        raise RuntimeError("Initial reviewed-data model was not promoted")

    second = await retraining_manager.maybe_retrain()
    print_phase("Immediate second check (must not retrain)", second)
    if second["promotions"] != 1:
        raise RuntimeError("Manager retrained without a new review batch")

    insert_reviewed_rows(database_path, start=121, count=24)
    transaction_store._initialize()
    third = await retraining_manager.maybe_retrain()
    print_phase("After 24 additional reviews (must not retrain)", third)
    if third["promotions"] != 1:
        raise RuntimeError("Manager retrained before reaching the 25-row batch")

    insert_reviewed_rows(database_path, start=145, count=1)
    transaction_store._initialize()
    fourth = await retraining_manager.maybe_retrain()
    print_phase("After the 25th additional review", fourth)
    if fourth["promotions"] != 2:
        raise RuntimeError("Manager did not retrain after the configured batch")

    model_status = local_model.status()
    print_phase("Hot-loaded local model", model_status)
    if model_status["dataset_source"] != "human-reviewed FinCluster simulator transactions":
        raise RuntimeError("Promoted reviewed-data model was not hot-loaded")

    print("\nCONTROLLED RETRAINING TEST PASSED")


def main() -> None:
    args = parse_args()
    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    database_path, artifact_path = configure_test_environment(backend_dir)

    remove_sqlite_files(database_path)
    artifact_path.unlink(missing_ok=True)

    try:
        asyncio.run(run_test(database_path, artifact_path))
    finally:
        if args.keep_files:
            print(f"\nKept test database: {database_path}")
            print(f"Kept test artifact: {artifact_path}")
        else:
            remove_sqlite_files(database_path)
            artifact_path.unlink(missing_ok=True)
            print("\nTemporary retraining database and artifact removed.")


if __name__ == "__main__":
    main()
