from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

from ml.local_model import LocalTransactionClassifier


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a trusted local FinCluster classifier from human-reviewed simulator rows."
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "transactions.db",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "models" / "transaction_classifier.joblib",
    )
    parser.add_argument("--min-rows", type=int, default=100)
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
            LocalTransactionClassifier._vectorize(
                amount=float(amount),
                tx_type=int(tx_type),
                account_age_days=int(account_age_days),
                mcc=str(mcc),
                is_vpn=bool(is_vpn),
            )
        )
        labels.append(int(reviewed_label == "heavy"))
    return features, labels


def main() -> None:
    args = parse_args()
    if not args.database.exists():
        raise SystemExit(f"Dataset database not found: {args.database}")

    features, labels = load_reviewed_rows(args.database)
    if len(features) < args.min_rows:
        raise SystemExit(
            f"Need at least {args.min_rows} human-reviewed rows; found {len(features)}."
        )
    if len(set(labels)) < 2:
        raise SystemExit("Reviewed data must contain both heavy and light labels.")

    x_train, x_valid, y_train, y_valid = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=2026,
        stratify=labels,
    )
    model = RandomForestClassifier(
        n_estimators=220,
        max_depth=10,
        min_samples_leaf=3,
        class_weight="balanced_subsample",
        random_state=2026,
        n_jobs=1,
    )
    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_valid)[:, 1]
    predictions = [
        int(probability >= LocalTransactionClassifier.HEAVY_THRESHOLD)
        for probability in probabilities
    ]
    metrics = {
        "accuracy": float(accuracy_score(y_valid, predictions)),
        "precision": float(precision_score(y_valid, predictions, zero_division=0)),
        "recall": float(recall_score(y_valid, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_valid, probabilities)),
        "training_rows": len(x_train),
        "validation_rows": len(x_valid),
    }

    artifact = {
        "feature_version": LocalTransactionClassifier.FEATURE_VERSION,
        "model": model,
        "model_name": "RandomForestClassifier-reviewed-v1",
        "dataset_source": "human-reviewed FinCluster simulator transactions",
        "metrics": metrics,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.output)

    print(f"Saved model: {args.output}")
    print(f"Reviewed rows: {len(features)}")
    for name, value in metrics.items():
        print(f"{name}: {value:.4f}" if isinstance(value, float) else f"{name}: {value}")
    print("Set LOCAL_MODEL_PATH to this trusted artifact and restart the backend.")


if __name__ == "__main__":
    main()
