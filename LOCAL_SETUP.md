# FinCluster AI — Local Windows Setup

The repository source is small. Large local folder sizes normally come from generated dependencies and caches such as `frontend/node_modules`, `frontend/.next`, Python virtual environments, and `__pycache__`.

## Recommended first run: Docker Compose

This keeps Python and Node dependencies out of the project folder. Docker stores them in images instead.

1. Install Docker Desktop and make sure it is running.
2. From the repository root, create the local configuration:

   ```bash
   cp .env.example .env
   ```

3. Change `SECRET_KEY`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in `.env`.
4. Build and start:

   ```bash
   docker compose up --build
   ```

5. Open:
   - Frontend: `http://localhost:3000`
   - Backend health: `http://localhost:8000`
   - Swagger: `http://localhost:8000/docs`
6. Stop with `Ctrl+C`, then:

   ```bash
   docker compose down
   ```

The local Compose configuration installs the optional XGBoost challenger and uses `LOCAL_MODEL_ALGORITHM=auto`. The normal Render Docker build does not install XGBoost unless explicitly configured, which protects a 512 MB free service from the extra memory cost.

## Native development setup

Use this when you want faster code editing and hot reload.

### Prerequisites

- Python 3.11 (matches the backend Docker image)
- Node.js 20.9 or newer
- Git

### Backend

From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
python -m pip install --upgrade pip
pip install -r requirements.txt -r requirements-xgboost.txt
cp .env.example .env
```

Edit `backend/.env` and use local paths:

```env
APP_ENV=development
SECRET_KEY=replace_with_a_long_random_secret
ADMIN_USERNAME=fincluster_admin
ADMIN_PASSWORD=change_this_local_password
ACCESS_TOKEN_HOURS=12
CORS_ORIGINS=http://localhost:3000
AI_DATASET_PATH=data/transactions.db
LOCAL_MODEL_PATH=
LOCAL_MODEL_ALGORITHM=auto
GEMINI_API_KEY=
EXTERNAL_AI_ENABLED=false
```

Start the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

Open a second terminal:

```bash
cd frontend
npm ci
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/telemetry
EOF
npm run dev
```

Open `http://localhost:3000`.

## Clean old generated dependencies

Run from the repository root in Git Bash only after closing dev servers and VS Code terminals that are using these folders:

```bash
rm -rf frontend/node_modules frontend/.next
rm -rf backend/.venv backend/venv .venv venv
rm -rf backend/.pytest_cache .pytest_cache
find . -type d -name __pycache__ -prune -exec rm -rf {} +
find . -type f -name '*.pyc' -delete
```

To find the largest directories in Git Bash:

```bash
du -sh .[^.]* * 2>/dev/null | sort -h
du -sh frontend/node_modules frontend/.next backend/.venv .git 2>/dev/null
```

## Model modes

- `LOCAL_MODEL_ALGORITHM=random_forest`: lowest memory and safest for Render Free.
- `LOCAL_MODEL_ALGORITHM=xgboost`: force XGBoost locally.
- `LOCAL_MODEL_ALGORITHM=auto`: train both candidates, tune thresholds, and select the stronger validation result.

The selected model and both candidate metrics are visible at `GET /api/v1/ai/status`.

## After collecting human-reviewed labels

Download the protected dataset export from `/api/v1/ai/dataset.csv`. When you have at least 100 reviewed rows, including at least 10 heavy and 10 light labels, train locally from one or more exports:

```bash
cd backend
source .venv/Scripts/activate
python scripts/train_from_collected_data.py --csv ../fincluster-training-data.csv --algorithm auto
```

Multiple exports can be merged and deduplicated by repeating `--csv`:

```bash
python scripts/train_from_collected_data.py \
  --csv ../export-1.csv \
  --csv ../export-2.csv \
  --algorithm auto
```

The winning reviewed-data artifact is saved to `backend/models/transaction_classifier.joblib`. To use it locally, set:

```env
LOCAL_MODEL_PATH=models/transaction_classifier.joblib
```
