# Security and Environment Setup

## Current MVP access model

- Dashboard telemetry and cluster status are public and read-only.
- Login creates a signed operator JWT.
- AI toggle, surge, anomaly, reset, and manual transaction injection require that JWT.
- For the hackathon, the single operator account is supplied through environment variables. No user database is required.
- For a production multi-user system, replace the environment account with a database-backed identity service, password hashing, roles, refresh-token rotation/revocation, and audit logs.

## 1. Revoke the exposed Gemini key

The previous repository contained a Gemini key in source code. Treat that key as compromised:

1. Open the Google AI Studio or Google Cloud credential page where the key was created.
2. Revoke or delete the exposed key.
3. Create a replacement only if you later restore the optional Gemini integration.
4. Restrict the replacement key to the required API and deployment environment.

This revision does not call Gemini, so `GEMINI_API_KEY` is not required for the current MVP.

## 2. Local backend environment

Copy the example file:

```bash
cd backend
cp .env.example .env
```

Set strong local values:

```env
APP_ENV=development
SECRET_KEY=<a-long-random-secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<a-strong-password>
ACCESS_TOKEN_HOURS=12
```

Generate a secret with Python:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Do not commit `.env`. The repository `.gitignore` ignores environment files while allowing `.env.example`.

## 3. Render environment variables

In the Render dashboard, open the backend service, then **Environment** and add:

```text
APP_ENV=production
SECRET_KEY=<generated-random-secret>
ADMIN_USERNAME=<operator-name>
ADMIN_PASSWORD=<strong-operator-password>
ACCESS_TOKEN_HOURS=12
```

Save and redeploy. Production startup intentionally fails when the old development secret or password is used.

A future asynchronous Gemini worker can receive:

```text
GEMINI_API_KEY=<replacement-key>
```

Do not add that key to source code or `.env.example`.

## 4. GitHub repository secrets

The current app does not need a Gemini key in GitHub unless a GitHub Actions workflow directly calls Gemini.

For a workflow that genuinely needs it:

1. Open the repository on GitHub.
2. Go to **Settings → Secrets and variables → Actions**.
3. Create a repository secret named `GEMINI_API_KEY`.
4. Reference it from a workflow as `${{ secrets.GEMINI_API_KEY }}`.

A GitHub secret does not automatically become a Render environment variable. Configure Render separately.

## 5. Remove the old key from Git history

Deleting the key from the latest file is not enough because earlier commits can still contain it.

First make a fresh backup and coordinate with all collaborators. Then use `git-filter-repo` on a fresh clone. Never place the compromised key in a committed file.

Example workflow:

```bash
git clone <repository-url> fincluster-clean
cd fincluster-clean
python -m pip install git-filter-repo
```

Create a temporary file outside the repository named `replacements.txt` containing:

```text
<PASTE-THE-OLD-COMPROMISED-KEY-HERE>==>REMOVED
```

Run:

```bash
git filter-repo --sensitive-data-removal --replace-text ../replacements.txt
```

Review the rewritten history, then force-push the rewritten branches and tags according to your repository permissions and GitHub's sensitive-data removal guidance. Delete `replacements.txt` afterward.

Every collaborator should discard old clones and re-clone the sanitized repository. Old forks, cached refs, pull-request refs, build logs, and copied secrets may require additional cleanup, which is why revocation is the first and most important step.
