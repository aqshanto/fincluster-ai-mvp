# FinCluster update: easiest deployment path

This package contains only the files changed for fixes 1–11. You do not need to create files or paste code manually.

## Before replacing files

1. Open the local folder you originally cloned from GitHub.
2. Confirm that the folder contains `.git`, `backend`, and `frontend`.
3. Create a backup branch:

```bash
git checkout -b backup-before-fixes
git push -u origin backup-before-fixes
git checkout main
```

## Apply the update

Extract the contents of this ZIP directly into the repository root—the same folder containing `backend` and `frontend`.

When Windows asks, choose **Replace the files in the destination**.

Do not delete or replace the hidden `.git` folder. This update package does not contain one.

## Configure Render before pushing

In Render, open the backend service and add these Environment variables:

```text
APP_ENV=production
SECRET_KEY=<a long random value>
ADMIN_USERNAME=<your chosen operator username>
ADMIN_PASSWORD=<your chosen strong password>
ACCESS_TOKEN_HOURS=12
```

Generate `SECRET_KEY` locally with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Do not add `GEMINI_API_KEY`. The updated MVP does not use Gemini.

## Deploy backend first

From the repository root:

```bash
git add .gitignore backend IMPLEMENTATION_NOTES.md SECURITY_SETUP.md EASY_DEPLOY_GUIDE.md
git commit -m "Fix simulation backend, security, and benchmark metrics"
git push origin main
```

Wait until the Render backend deployment is Live. Test:

- `https://fincluster-backend.onrender.com/`
- `https://fincluster-backend.onrender.com/docs`

## Deploy frontend second

```bash
git add frontend
git commit -m "Connect dashboard to real benchmark and routing telemetry"
git push origin main
```

Vercel should automatically deploy the frontend commit.

## Vercel variables

Keep or verify these existing variables:

```text
NEXT_PUBLIC_API_URL=https://fincluster-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://fincluster-backend.onrender.com/ws/telemetry
```

Apply them to Production. If you change a Vercel variable, redeploy because variables do not affect previous deployments.

## Final test

1. Open the public dashboard without logging in; telemetry should be visible.
2. Try a control; it should request operator login.
3. Log in using the Render `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
4. Test AI toggle, surge, anomaly, reset, and simulator injection.
5. Open a second dashboard tab and confirm simulation speed does not change.

## Rollback

If needed, restore the old code:

```bash
git checkout backup-before-fixes -- .
git commit -m "Rollback phase 2 fixes"
git push origin main
```
