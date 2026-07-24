from __future__ import annotations

import csv
import json
import random
from pathlib import Path
from typing import Literal

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "demo_data"
HEADERS = [
    "event_uid",
    "amount",
    "tx_type",
    "account_age_days",
    "mcc",
    "is_vpn",
    "predicted_label",
    "model_probability",
    "model_confidence",
    "risk_score",
    "risk_level",
    "task_path",
    "reviewed_label",
    "reviewed_by",
    "reviewed_at",
    "review_note",
]

Label = Literal["heavy", "light"]


def clear_row(rng: random.Random, label: Label, uid: str) -> dict[str, object]:
    if label == "heavy":
        amount = round(rng.uniform(28_000, 95_000), 2)
        tx_type = rng.choices([1, 0], weights=[0.72, 0.28], k=1)[0]
        age = rng.randint(0, 55)
        mcc = rng.choices(["7995", "6011"], weights=[0.62, 0.38], k=1)[0]
        vpn = rng.random() < 0.76
        probability = rng.uniform(0.76, 0.97)
        note = "High-complexity transaction requiring enhanced verification"
    else:
        amount = round(rng.uniform(120, 7_500), 2)
        tx_type = rng.choices([2, 0], weights=[0.66, 0.34], k=1)[0]
        age = rng.randint(180, 2600)
        mcc = rng.choices(["5411", "4814"], weights=[0.68, 0.32], k=1)[0]
        vpn = False
        probability = rng.uniform(0.03, 0.24)
        note = "Low-complexity trusted transaction suitable for the fast path"
    return build_row(uid, amount, tx_type, age, mcc, vpn, label, probability, note)


def edge_row(rng: random.Random, label: Label, uid: str, phase: int) -> dict[str, object]:
    pattern = rng.randrange(4)
    if label == "heavy":
        if pattern == 0:
            amount, tx_type, age, mcc, vpn = rng.uniform(8_000, 18_000), 1, rng.randint(0, 14), "6011", True
            note = "Moderate amount but new account, cashout, and VPN require heavy review"
        elif pattern == 1:
            amount, tx_type, age, mcc, vpn = rng.uniform(1_000, 6_000), 0, rng.randint(0, 10), "7995", True
            note = "Low amount with masked gambling merchant pattern requires deep checks"
        elif pattern == 2:
            amount, tx_type, age, mcc, vpn = rng.uniform(24_000, 55_000), 0, rng.randint(300, 1800), "6011", False
            note = "High-value transfer requires enhanced processing despite established account"
        else:
            amount, tx_type, age, mcc, vpn = rng.uniform(12_000, 28_000), 1, rng.randint(20, 120), "5411", phase >= 3
            note = "Cashout interaction pattern was corrected by human reviewers"
        probability = rng.uniform(0.56, 0.78)
    else:
        if pattern == 0:
            amount, tx_type, age, mcc, vpn = rng.uniform(20_000, 42_000), 2, rng.randint(900, 3000), "5411", False
            note = "High amount from a mature account remains a light merchant-payment path"
        elif pattern == 1:
            amount, tx_type, age, mcc, vpn = rng.uniform(400, 2_500), 1, rng.randint(200, 1800), "5411", False
            note = "Small cashout from an established account is confirmed light"
        elif pattern == 2:
            amount, tx_type, age, mcc, vpn = rng.uniform(2_000, 9_000), 0, rng.randint(80, 500), "4814", False
            note = "Normal transfer with no elevated factors remains light"
        else:
            amount, tx_type, age, mcc, vpn = rng.uniform(300, 1_800), 2, rng.randint(7, 40), "5411", False
            note = "Young account alone does not require heavy processing"
        probability = rng.uniform(0.22, 0.47)
    return build_row(uid, round(amount, 2), tx_type, age, mcc, vpn, label, probability, note)


def build_row(
    uid: str,
    amount: float,
    tx_type: int,
    age: int,
    mcc: str,
    vpn: bool,
    label: Label,
    probability: float,
    note: str,
) -> dict[str, object]:
    predicted = label
    risk_score = round(probability * 100, 1)
    return {
        "event_uid": uid,
        "amount": round(float(amount), 2),
        "tx_type": tx_type,
        "account_age_days": age,
        "mcc": mcc,
        "is_vpn": str(vpn).lower(),
        "predicted_label": predicted,
        "model_probability": round(probability, 4),
        "model_confidence": round(abs(probability - 0.5) * 2.0, 4),
        "risk_score": risk_score,
        "risk_level": "high" if probability >= 0.72 else "medium" if probability >= 0.5 else "low",
        "task_path": "DEEP FRAUD CHECK" if label == "heavy" and probability >= 0.72 else "ENHANCED VERIFICATION" if label == "heavy" else "LIGHT FAST-PATH",
        "reviewed_label": label,
        "reviewed_by": "pre-hackathon-team",
        "reviewed_at": "2026-07-20T10:00:00+00:00",
        "review_note": note,
    }


def make_balanced_batch(
    rng: random.Random,
    start_uid: int,
    light_count: int,
    heavy_count: int,
    *,
    phase: int,
    edge_ratio: float,
) -> list[dict[str, object]]:
    labels: list[Label] = ["light"] * light_count + ["heavy"] * heavy_count
    rng.shuffle(labels)
    rows: list[dict[str, object]] = []
    for offset, label in enumerate(labels):
        uid_num = start_uid + offset
        uid = f"DEMO-{uid_num:06d}"
        if rng.random() < edge_ratio:
            row = edge_row(rng, label, uid, phase)
        else:
            row = clear_row(rng, label, uid)
        # Include a small, transparent number of model corrections in later batches.
        if phase >= 2 and rng.random() < (0.08 if phase == 2 else 0.05):
            row["predicted_label"] = "light" if label == "heavy" else "heavy"
            row["review_note"] = f"Human reviewer corrected the original model. {row['review_note']}"
        rows.append(row)
    return rows


def write_csv(name: str, rows: list[dict[str, object]]) -> None:
    path = OUTPUT / name
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    baseline = make_balanced_batch(random.Random(101), 1, 50, 49, phase=1, edge_ratio=0.22)
    batch2 = make_balanced_batch(random.Random(202), 101, 50, 50, phase=2, edge_ratio=0.72)
    batch3 = make_balanced_batch(random.Random(303), 201, 50, 50, phase=3, edge_ratio=0.58)
    evaluation = make_balanced_batch(random.Random(909), 900001, 60, 60, phase=3, edge_ratio=0.65)

    write_csv("baseline_099.csv", baseline)
    write_csv("batch_02_rows_101_200.csv", batch2)
    write_csv("batch_03_rows_201_300.csv", batch3)
    write_csv("fixed_evaluation_120.csv", evaluation)

    manifest = {
        "dataset_name": "FinCluster Pre-Hackathon Human-Reviewed Demo Dataset",
        "dataset_version": "demo-reviewed-v1",
        "source": "FinCluster simulator-generated scenarios reviewed by the project team",
        "contains_real_customer_data": False,
        "fixed_evaluation_file": "fixed_evaluation_120.csv",
        "batches": [
            {
                "batch_id": "baseline-099",
                "label": "Baseline 0 → 99",
                "filename": "baseline_099.csv",
                "rows": 99,
                "expected_start_reviewed": 0,
                "expected_end_reviewed": 99,
                "description": "Prepared reviewed baseline. It intentionally stops one row before the first retraining threshold.",
            },
            {
                "batch_id": "batch-02-101-200",
                "label": "Batch 2: 100 → 200",
                "filename": "batch_02_rows_101_200.csv",
                "rows": 100,
                "expected_start_reviewed": 100,
                "expected_end_reviewed": 200,
                "description": "One hundred new reviewed edge cases for the second controlled retraining cycle.",
            },
            {
                "batch_id": "batch-03-201-300",
                "label": "Batch 3: 200 → 300",
                "filename": "batch_03_rows_201_300.csv",
                "rows": 100,
                "expected_start_reviewed": 200,
                "expected_end_reviewed": 300,
                "description": "A third reviewed batch containing corrected interaction patterns.",
            },
        ],
        "limitations": [
            "Synthetic simulator scenarios, not production banking data",
            "Metrics demonstrate the controlled learning pipeline",
            "The evaluation set is never imported into the training database",
        ],
    }
    (OUTPUT / "dataset_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"Generated demo datasets in {OUTPUT}")


if __name__ == "__main__":
    main()
