# FinCluster PostgreSQL Hackathon Demo

## Render backend environment

Add the Render PostgreSQL **Internal Database URL** as `DATABASE_URL`. Do not commit it.

```env
DATABASE_URL=<Render Internal Database URL>
AUTO_RETRAIN_ENABLED=true
AUTO_RETRAIN_MIN_REVIEWED=100
AUTO_RETRAIN_BATCH_SIZE=100
AUTO_RETRAIN_ALGORITHM=auto
AUTO_RETRAIN_MODEL_PATH=models/transaction_classifier.joblib
TELEMETRY_BROADCAST_INTERVAL_SECONDS=1.0
```

Keep the existing security and CORS values. Deploy after pushing the updated backend.

## What is persistent

When `DATABASE_URL` is present, PostgreSQL stores:

- sampled and manual transactions;
- pending and resolved human reviews;
- prepared CSV import history and file hashes;
- the last attempted and promoted retraining thresholds;
- every retraining result;
- the binary bytes of every promoted model artifact.

After a backend restart, the newest approved model is written back to the local model path and hot-loaded. Local development still uses SQLite when `DATABASE_URL` is blank.

## Judge demonstration

1. Sign in as the operator.
2. Open **Dataset** in the dashboard footer.
3. Import **Baseline 0 → 99**.
4. Open **Manual Tx** and inject this heavy scenario with **Force human review** enabled:
   - Amount: `48000`
   - Type: cashout (`1`)
   - Account age: `3`
   - MCC: `7995`
   - VPN: `true`
5. Open **Reviews 1** and resolve it as **Heavy**.
6. The reviewed total becomes `100`; retraining cycle 1 starts automatically.
7. Open **Dataset** again and inspect Training #1 and the changed accuracy.
8. Import **Batch 2: 100 → 200**. Retraining cycle 2 runs once.
9. Import **Batch 3: 200 → 300**. Retraining cycle 3 runs once.
10. Restart the Render backend and show that the dataset, history, thresholds, and promoted model remain available.
11. For another rehearsal, use **Dataset → Reset learning demo**. This is separate from **Reset Sim** and requires operator confirmation.

## Dataset integrity

The prepared files are in `backend/demo_data/`:

- `baseline_099.csv`
- `batch_02_rows_101_200.csv`
- `batch_03_rows_201_300.csv`
- `fixed_evaluation_120.csv`
- `dataset_manifest.json`

They contain synthetic simulator scenarios reviewed by the team, not real bank or customer data. The fixed evaluation file is never imported into the training database. Every model version is evaluated against those same 120 untouched rows.

Prepared imports are strict and idempotent:

- the baseline only imports when the reviewed count is `0`;
- batch 2 only imports when the reviewed count is `100`;
- batch 3 only imports when the reviewed count is `200`;
- a repeated batch ID or identical file hash is ignored;
- a batch is committed atomically or rolled back completely.

## Expected deterministic demo metrics

Using the prepared datasets and the recommended manual Heavy review, the Random Forest candidate produced these fixed-evaluation results during local validation:

| Reviewed rows | Accuracy | Heavy recall | Result |
|---:|---:|---:|---|
| 100 | 85.8% | 100.0% | Passes gates |
| 200 | 99.2% | 100.0% | Passes gates |
| 300 | 100.0% | 100.0% | Passes gates |

Exact candidate selection can differ when XGBoost versions or environment settings change. The system reports the actual measured result and never fabricates an accuracy value.

## Thermal telemetry

The backend still calculates the simulation ten times per second, while WebSocket snapshots are sent once per second. Node temperatures now follow load-dependent target temperatures and the UI displays one decimal place, so normal heating and cooling remain visible without returning to the earlier bandwidth usage.

## Rehearsal reset

The protected `POST /api/v1/ai/demo/reset` endpoint clears only the persistent learning demonstration state: reviewed rows, prepared import history, retraining history, and promoted artifacts. It then restores the seeded synthetic champion. The ordinary **Reset Sim** button still resets only live simulation counters and never deletes PostgreSQL evidence.
