# FinCluster Hybrid AI Implementation

## Recommended architecture

FinCluster now separates workload generation from optional external AI review:

1. **Automatic simulation:** always uses a local scikit-learn `RandomForestClassifier`. It never calls an external API, so traffic surges cannot consume quota or freeze the simulation.
2. **Manual simulation:** uses the same local model by default. When an operator enables **Manual AI API** and the backend has `GEMINI_API_KEY`, only manually injected transactions are sent to Gemini.
3. **Fallback:** API timeout, quota, malformed output, or provider failure automatically falls back to the local model.
4. **Legacy benchmark:** still routes the exact same classified task stream through round-robin for a fair comparison.

This is a hybrid AI design: local machine learning for high-volume inference, an optional LLM for low-volume human-triggered review, and transparent rules only for explanations or last-resort availability.

## Why this is suitable now

The project has no bank-owned labeled transaction data. Claiming a production fraud model would therefore be misleading. The local model is initially trained on 6,000 seeded synthetic MFS workload examples generated from a non-linear risk process with interactions and noise. Its held-out synthetic validation metrics are exposed by `/api/v1/ai/status`.

Current seeded run metrics are approximately:

- Accuracy: 0.874
- Precision: 0.649
- Recall: 0.742
- ROC AUC: 0.870

These numbers measure performance on the synthetic simulator distribution only. They are not real banking fraud accuracy.

## Data collection and future training

FinCluster now stores a bounded, privacy-aware SQLite dataset:

- Every manual transaction is recorded.
- Automatic traffic is sampled once every 25 generated events by default.
- Raw IP address, terminal ID, device ID, STAN, and RRN are not stored.
- An operator can assign a human-reviewed `heavy` or `light` label in the UI.
- The dataset can be exported from the dashboard or `/api/v1/ai/dataset.csv`.

After collecting at least 100 balanced reviewed rows, train a model artifact:

```bash
cd backend
python scripts/train_from_collected_data.py \
  --database data/transactions.db \
  --output models/transaction_classifier.joblib
```

Then set:

```env
LOCAL_MODEL_PATH=/app/models/transaction_classifier.joblib
```

Only load model artifacts created by this project. Pickle/joblib artifacts are executable Python objects and must never be accepted from untrusted users.

## Gemini setup

Create a server-side API key and add it only to the backend environment:

```env
GEMINI_API_KEY=your_server_side_key
GEMINI_MODEL=gemini-3-flash-preview
EXTERNAL_AI_ENABLED=false
AI_API_TIMEOUT_SECONDS=5
AI_API_MAX_REQUESTS_PER_MINUTE=8
AI_API_CACHE_SIZE=256
```

The key must never use the `NEXT_PUBLIC_` prefix and must never be placed in frontend code. After deployment, sign in as operator and enable **Manual AI API**. The toggle is unavailable when no key is configured.

The external request sends only typed classification features: amount, transaction type, account age, MCC, and VPN flag. It does not send personal identifiers. Responses use a strict JSON schema, timeout, cache, request-per-minute limit, and a circuit breaker.

## Public datasets

PaySim is a useful later benchmark because it is a synthetic mobile-money transaction dataset derived from statistical patterns in private mobile-money logs. It is not live data and its fields do not exactly match FinCluster's account-age, MCC, and VPN features. Use it for comparative fraud experiments or extend FinCluster's feature schema before importing it; do not silently mix incompatible fields.

## API endpoints added

- `GET /api/v1/ai/status`
- `POST /api/v1/control/toggle-external-ai`
- `POST /api/v1/ai/feedback`
- `GET /api/v1/ai/dataset.csv`

## Deployment notes

- Automatic classification remains functional with no API key.
- External inference happens outside the global simulation lock.
- Use persistent storage for `AI_DATASET_PATH`; an ephemeral deployment filesystem can lose collected rows after a restart.
- The local model is trained at process startup unless a trusted reviewed-data artifact is configured.
