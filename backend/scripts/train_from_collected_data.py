from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path
from typing import Any

import joblib

from ml.features import FEATURE_VERSION, vectorize_transaction
from ml.model_training import train_and_select_model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Train Random Forest/XGBoost candidates from human-reviewed FinCluster rows "
            "and save the stronger validated model."
        )
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "transactions.db",
    )
    parser.add_argument(
        "--csv",
        action="append",
        type=Path,
        default=[],
        help="Optional exported dataset CSV. Repeat --csv to merge several exports.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "models"
        / "transaction_classifier.joblib",
    )
    parser.add_argument("--min-rows", type=int, default=100)
    parser.add_argument(
        "--algorithm",
        choices=["auto", "random_forest", "xgboost"],
        default="auto",
    )
    return parser.parse_args()


def _normalise_row(row: dict[str, Any]) -> dict[str, Any] | None:
    label = str(row.get("reviewed_label", "")).strip().lower()
    if label not in {"heavy", "light"}:
        return None
    return {
        "event_uid": str(row.get("event_uid", "")),
        "amount": float(row["amount"]),
        "tx_type": int(row["tx_type"]),
        "account_age_days": int(row["account_age_days"]),
        "mcc": str(row["mcc"]),
        "is_vpn": str(row["is_vpn"]).strip().lower() in {"1", "true", "yes"},
        "reviewed_label": label,
    }


def load_database_rows(database: Path) -> list[dict[str, Any]]:
    if not database.exists():
        return []
    with sqlite3.connect(database) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT event_uid, amount, tx_type, account_age_days, mcc,
                   is_vpn, reviewed_label
            FROM transactions
            WHERE reviewed_label IN ('heavy', 'light')
            ORDER BY record_id ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def load_csv_rows(paths: list[Path]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in paths:
        if not path.exists():
            raise SystemExit(f"CSV dataset not found: {path}")
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            for raw in csv.DictReader(handle):
                row = _normalise_row(raw)
                if row:
                    rows.append(row)
    return rows


def deduplicate(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduplicated: dict[str, dict[str, Any]] = {}
    anonymous = 0
    for row in rows:
        normalized = _normalise_row(row)
        if normalized is None:
            continue
        key = normalized["event_uid"].strip()
        if not key:
            anonymous += 1
            key = f"anonymous:{anonymous}"
        deduplicated[key] = normalized
    return list(deduplicated.values())


def main() -> None:
    args = parse_args()
    rows = deduplicate(load_database_rows(args.database) + load_csv_rows(args.csv))
    if len(rows) < args.min_rows:
        raise SystemExit(
            f"Need at least {args.min_rows} human-reviewed rows; found {len(rows)}."
        )

    heavy_rows = sum(1 for row in rows if row["reviewed_label"] == "heavy")
    light_rows = len(rows) - heavy_rows
    if min(heavy_rows, light_rows) < 10:
        raise SystemExit("Reviewed data must contain at least 10 heavy and 10 light rows.")

    features = [
        vectorize_transaction(
            amount=float(row["amount"]),
            tx_type=int(row["tx_type"]),
            account_age_days=int(row["account_age_days"]),
            mcc=str(row["mcc"]),
            is_vpn=bool(row["is_vpn"]),
        )
        for row in rows
    ]
    labels = [int(row["reviewed_label"] == "heavy") for row in rows]
    selection = train_and_select_model(
        features,
        labels,
        requested_algorithm=args.algorithm,
        seed=2026,
        dataset_label="reviewed",
    )

    artifact = {
        "feature_version": FEATURE_VERSION,
        "model": selection.model,
        "model_name": selection.model_name,
        "dataset_source": "human-reviewed FinCluster simulator transactions",
        "selected_algorithm": selection.selected_algorithm,
        "threshold": selection.threshold,
        "metrics": selection.metrics.as_dict(),
        "candidate_metrics": selection.candidate_metrics,
        "reviewed_rows": len(rows),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.output)

    print(f"Saved model: {args.output}")
    print(f"Reviewed rows: {len(rows)} (heavy={heavy_rows}, light={light_rows})")
    print(f"Selected algorithm: {selection.selected_algorithm}")
    print(f"Model name: {selection.model_name}")
    print("Held-out test metrics:")
    for name, value in selection.metrics.as_dict().items():
        print(f"  {name}: {value}")
    print("Candidate validation metrics:")
    for candidate, metrics in selection.candidate_metrics.items():
        print(f"  {candidate}: {metrics}")
    print("Set LOCAL_MODEL_PATH to this artifact and restart the backend.")


if __name__ == "__main__":
    main()
