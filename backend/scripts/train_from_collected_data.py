from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path

import joblib

from ml.features import FEATURE_VERSION, vectorize_transaction
from ml.model_training import train_and_select_model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Train Random Forest and/or XGBoost candidates from human-reviewed "
            "FinCluster simulator rows and save the validated winner."
        )
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "transactions.db",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        action="append",
        default=[],
        help=(
            "exported dataset CSV; repeat --csv to merge multiple exports. "
            "When supplied, CSV input takes precedence over --database"
        ),
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
        help="auto trains both available candidates and saves the stronger one",
    )
    return parser.parse_args()


def load_reviewed_rows(database: Path) -> tuple[list[list[float]], list[int]]:
    with sqlite3.connect(database) as connection:
        rows = connection.execute(
            """
            SELECT amount, tx_type, account_age_days, mcc, is_vpn, reviewed_label
            FROM transactions
            WHERE reviewed_label IN ('heavy', 'light')
            ORDER BY record_id ASC
            """
        ).fetchall()

    features: list[list[float]] = []
    labels: list[int] = []
    for amount, tx_type, account_age_days, mcc, is_vpn, reviewed_label in rows:
        features.append(
            vectorize_transaction(
                amount=float(amount),
                tx_type=int(tx_type),
                account_age_days=int(account_age_days),
                mcc=str(mcc),
                is_vpn=bool(is_vpn),
            )
        )
        labels.append(int(reviewed_label == "heavy"))
    return features, labels


def load_reviewed_csvs(paths: list[Path]) -> tuple[list[list[float]], list[int]]:
    features: list[list[float]] = []
    labels: list[int] = []
    seen_event_uids: set[str] = set()

    for path in paths:
        if not path.exists():
            raise SystemExit(f"Dataset CSV not found: {path}")
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            required = {
                "event_uid",
                "amount",
                "tx_type",
                "account_age_days",
                "mcc",
                "is_vpn",
                "reviewed_label",
            }
            missing = required.difference(reader.fieldnames or [])
            if missing:
                raise SystemExit(
                    f"Dataset CSV {path} is missing columns: {', '.join(sorted(missing))}"
                )
            for row in reader:
                reviewed_label = str(row.get("reviewed_label", "")).strip().lower()
                event_uid = str(row.get("event_uid", "")).strip()
                if reviewed_label not in {"heavy", "light"} or not event_uid:
                    continue
                if event_uid in seen_event_uids:
                    continue
                seen_event_uids.add(event_uid)
                features.append(
                    vectorize_transaction(
                        amount=float(row["amount"]),
                        tx_type=int(row["tx_type"]),
                        account_age_days=int(row["account_age_days"]),
                        mcc=str(row["mcc"]),
                        is_vpn=str(row["is_vpn"]).strip().lower() in {"1", "true", "yes"},
                    )
                )
                labels.append(int(reviewed_label == "heavy"))

    return features, labels


def main() -> None:
    args = parse_args()
    if args.csv:
        features, labels = load_reviewed_csvs(args.csv)
        source_description = ", ".join(str(path) for path in args.csv)
    else:
        if not args.database.exists():
            raise SystemExit(f"Dataset database not found: {args.database}")
        features, labels = load_reviewed_rows(args.database)
        source_description = str(args.database)
    if len(features) < args.min_rows:
        raise SystemExit(
            f"Need at least {args.min_rows} human-reviewed rows; found {len(features)}."
        )

    heavy_rows = sum(labels)
    light_rows = len(labels) - heavy_rows
    if min(heavy_rows, light_rows) < 10:
        raise SystemExit(
            "Reviewed data must contain at least 10 heavy and 10 light labels. "
            f"Found heavy={heavy_rows}, light={light_rows}."
        )

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
        "selected_algorithm": selection.selected_algorithm,
        "dataset_source": "human-reviewed FinCluster simulator transactions",
        "threshold": selection.threshold,
        "metrics": selection.metrics.as_dict(),
        "candidate_metrics": selection.candidate_metrics,
        "reviewed_rows": len(features),
        "heavy_rows": heavy_rows,
        "light_rows": light_rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.output)

    print(f"Saved model: {args.output}")
    print(f"Training source: {source_description}")
    print(f"Reviewed rows: {len(features)} (heavy={heavy_rows}, light={light_rows})")
    print(f"Selected algorithm: {selection.selected_algorithm}")
    print(f"Model name: {selection.model_name}")
    print(f"Decision threshold: {selection.threshold:.2f}")
    print("Held-out test metrics:")
    for name, value in selection.metrics.as_dict().items():
        print(f"  {name}: {value}")
    print("Validation candidate metrics:")
    for candidate, metrics in selection.candidate_metrics.items():
        print(f"  {candidate}: {metrics}")
    print("Set LOCAL_MODEL_PATH to this trusted artifact and restart the backend.")


if __name__ == "__main__":
    main()
