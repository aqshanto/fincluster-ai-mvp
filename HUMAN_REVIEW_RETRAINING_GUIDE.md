# FinCluster Human Review and Controlled Retraining

## Important terminology

The model cannot know that a live prediction is wrong until a trusted label is supplied. Therefore FinCluster does **not** mark uncertain predictions as transaction failures. It places selected manual transactions in a `pending_review` state and holds them before node routing.

A transaction enters review when:

- local-model confidence is below `HUMAN_REVIEW_CONFIDENCE_THRESHOLD`;
- the ML engine used a fallback;
- Gemini and the local model disagree; or
- the operator selects **Force human review**.

Automatic simulator traffic remains local and is never blocked by the review queue.

## Review flow

1. A manual transaction is classified.
2. If review is required, it is stored without IP, device ID, terminal ID, STAN, or RRN.
3. No processing node is selected while it is pending.
4. The operator chooses **Heavy** or **Light**.
5. The reviewed task is routed according to that human label.
6. The original prediction and human label are compared.
7. `prediction_correct` is stored for real reviewed accuracy measurement.
8. The reviewed row becomes eligible for later supervised retraining.

## Local environment

Add these values to `backend/.env`:

```env
LOCAL_MODEL_ALGORITHM=auto
LOCAL_MODEL_PATH=

HUMAN_REVIEW_ENABLED=true
HUMAN_REVIEW_CONFIDENCE_THRESHOLD=0.25
HUMAN_REVIEW_FALLBACK_REQUIRED=true

AUTO_RETRAIN_ENABLED=false
AUTO_RETRAIN_MIN_REVIEWED=100
AUTO_RETRAIN_BATCH_SIZE=25
AUTO_RETRAIN_ALGORITHM=auto
AUTO_RETRAIN_MODEL_PATH=models/transaction_classifier.joblib
```

Install XGBoost inside the active backend virtual environment:

```bash
python -m pip install -r requirements-xgboost.txt
```

## First test

Start the backend and frontend. In **Manual Tx**, select **Force human review** and submit a transaction.

Expected behavior:

- response status is `pending_review`;
- the dashboard **Reviews** counter increases;
- no node processes the task;
- choosing Heavy or Light routes the task;
- the reviewed label is stored in SQLite.

Protected endpoints:

```text
GET  /api/v1/ai/reviews
POST /api/v1/ai/reviews/resolve
POST /api/v1/ai/feedback
GET  /api/v1/ai/dataset.csv
```

## Controlled automatic retraining

Do not enable retraining until you have at least 100 reviewed rows, including at least 10 Heavy and 10 Light labels. For a more useful experiment, collect 300–500 balanced reviewed rows.

When ready, set:

```env
AUTO_RETRAIN_ENABLED=true
```

The manager then checks after every review. It retrains only when:

- the minimum reviewed count has been reached; and
- at least `AUTO_RETRAIN_BATCH_SIZE` new reviewed labels exist since the last promoted model.

Training runs in a background thread. Random Forest and XGBoost are evaluated on the same data. A candidate is promoted only if it passes the configured selection-score, recall, and balanced-accuracy gates. The validated artifact is written atomically and hot-loaded. The currently working model remains online if training fails or the challenger fails its quality gates.

Check status:

```text
GET /api/v1/ai/status
```

Look under `retraining` and `ai_runtime.local_model`.

## Manual offline training

You can still create an artifact manually:

```bash
cd backend
python scripts/train_from_collected_data.py --algorithm auto
```

Or from one or more exported CSV files:

```bash
python scripts/train_from_collected_data.py \
  --csv ../export-1.csv \
  --csv ../export-2.csv \
  --algorithm auto
```

## Production warning

Keep `AUTO_RETRAIN_ENABLED=false` on a small Render instance. Collect and export reviewed labels, then train locally. Commit neither the SQLite database nor `.joblib` artifacts unless you intentionally choose an artifact-deployment strategy.
