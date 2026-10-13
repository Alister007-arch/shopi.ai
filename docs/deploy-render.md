# Deploying Trovi on Render

This guide provides instructions for deploying the Trovi Autonomous E-Commerce platform to [Render](https://render.com) using the production multi-stage Dockerfile.

---

## Architecture Overview

Trovi is packaged as a single unified Docker container:
- **Stage 1 (`frontend-builder`)**: Compiles the React (Vite + Tailwind/Vanilla CSS) storefront into production static bundles located in `/app/frontend/dist`.
- **Stage 2 (`runner`)**: Configures Python 3.11 with FastAPI, Uvicorn, SQLite/PostgreSQL, business policies (`config/`), prompt templates (`prompts/`), and database migrations (`alembic.ini`).
- **Runtime Assets**: Serves API routes (`/api/*`), autonomous shopping agent graph (`/api/chat`), policy rules (`/api/policies`), and SPA frontend assets.

---

## 1. Render Service Configuration

When creating a new service in the Render Dashboard:

| Setting | Value |
|---|---|
| **Service Type** | Web Service |
| **Environment** | Docker |
| **Repository** | Your connected GitHub repo |
| **Branch** | `main` or `upgrade/production` |
| **Root Directory** | Leave blank (default repo root `.`) |
| **Dockerfile Path** | `./Dockerfile` |
| **Docker Build Context** | `.` |
| **Health Check Path** | `/api/health` |
| **Auto-Deploy** | Yes |

---

## 2. Persistent Storage Requirement (Critical)

> [!WARNING]
> **Ephemeral Storage Notice:** Render Web Service containers run on an ephemeral filesystem. Any file written directly inside the container (such as `shopai.db` in SQLite mode) will be wiped on every redeploy, restart, or instance restart.

You must configure persistent storage using either **Option A** (Render Disk + SQLite) or **Option B** (Managed PostgreSQL):

### Option A: SQLite with Render Persistent Disk (Recommended for Single-Instance)
1. In the Render Dashboard, navigate to your Web Service.
2. Go to **Disks** tab -> Click **Add Disk**.
3. Configure the disk:
   - **Name**: `trovi-data`
   - **Mount Path**: `/data`
   - **Size**: `1 GB` (or larger if storing product image uploads)
4. Add the following environment variable in the **Environment** tab:
   ```env
   SHOPI_DB_PATH=/data/shopai.db
   ```
5. When Trovi boots, it detects `/data/shopai.db`. If the database does not yet exist on the persistent disk, the auto-seeder initializes it with the complete verified product catalog and default users automatically. All orders, addresses, and user accounts will persist across deploys.

### Option B: Managed Render PostgreSQL (Recommended for Multi-Instance / Scaling)
1. In Render Dashboard, click **New +** -> **PostgreSQL**.
2. Name the database (e.g. `trovi-db`) and create it.
3. Copy the **Internal Database URL** (e.g. `postgresql+psycopg2://trovi_user:password@dpg-xxxxx/trovi_db`).
4. Set the following environment variable on your Web Service:
   ```env
   DATABASE_URL=postgresql+psycopg2://trovi_user:password@dpg-xxxxx/trovi_db
   ```
5. Database migrations run automatically during startup via `init_db()`.

---

## 3. Environment Variables Reference

### How to Configure Environment Variables in the Render Dashboard:
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Select your Trovi Web Service.
3. In the left navigation menu, click **Environment**.
4. Click **Add Environment Variable** for individual keys, or use **Add from .env** to paste multiple keys.
5. Enter the **Key** (variable name) and **Value**.
6. Click **Save Changes** (Render will automatically redeploy the service with the new environment).

### Required Variables


| Variable Name | Example Value | Description |
|---|---|---|
| `PORT` | `8000` | Port for the Uvicorn server. Render automatically sets this, and the Dockerfile defaults to `${PORT:-8000}`. |
| `ENVIRONMENT` | `production` | Sets application mode to `production`. Activates strict JWT security and production safeguards. |
| `JWT_SECRET_KEY` | *(Random 32+ char string)* | **Mandatory in production.** Secret used to sign JWT auth tokens. Generate via `openssl rand -hex 32`. The startup self-check will reject default dev keys in production. |
| `SHOPI_DB_PATH` or `DATABASE_URL` | `/data/shopai.db` | Path to persistent SQLite file or PostgreSQL connection URL (see persistent storage section above). |
| `GROQ_API_KEY` | `gsk_...` | API key for Groq inference (Llama 3.3 70B versatile model powering the autonomous shopping agent). |

### Optional Variables

| Variable Name | Default Value | Description |
|---|---|---|
| `POLICY_PATH` | `/app/config/policies.yaml` | Custom path to store policies YAML. Defaults to `/app/config/policies.yaml`. |
| `AGENT_PROMPT_PATH` | `/app/prompts/agent_system.md` | Custom path to agent prompt markdown. Defaults to `/app/prompts/agent_system.md`. |
| `ALEMBIC_CONFIG_PATH` | `/app/alembic.ini` | Custom path to Alembic configuration file. |
| `GEMINI_API_KEY` | *(None)* | Google Gemini API key used as fallback LLM if Groq rate limit is reached. |
| `CORS_ORIGINS` | `https://your-service.onrender.com` | Comma-separated list of allowed CORS origins. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Auth access token lifetime in minutes. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Auth refresh token lifetime in days. |
| `SMTP_HOST` | *(None)* | SMTP server hostname for live transactional emails. |
| `SMTP_PORT` | `587` | SMTP port (e.g. 587 for TLS, 465 for SSL). |
| `SMTP_USER` | *(None)* | SMTP username. |
| `SMTP_PASSWORD` | *(None)* | SMTP password or app-specific password. |
| `SMTP_FROM` | `orders@trovi.store` | From address for transactional emails. |
| `TWILIO_ACCOUNT_SID` | *(None)* | Twilio account SID for SMS / WhatsApp OTP notifications. |
| `TWILIO_AUTH_TOKEN` | *(None)* | Twilio authentication token. |
| `TWILIO_FROM_NUMBER` | *(None)* | Twilio phone number for SMS. |
| `TWILIO_WHATSAPP_FROM_NUMBER` | *(None)* | Twilio WhatsApp Sender number. |

> [!NOTE]
> If SMTP or Twilio credentials are not provided, notifications fall back safely to console simulation logs and SQLite recording without failing application requests.

---

## 4. Startup Self-Check Protection

Trovi includes an automated pre-flight self-check (`backend/app/startup_check.py`) that runs before server initialization:
1. **Verifies Runtime Files:**
   - Policy file: `config/policies.yaml` (or `POLICY_PATH`)
   - Agent prompt: `prompts/agent_system.md` (or `AGENT_PROMPT_PATH`)
   - Alembic config: `alembic.ini` (or `ALEMBIC_CONFIG_PATH`)
2. **Verifies Environment Variables (by name only):**
   - In `production`: Ensures `JWT_SECRET_KEY` is explicitly configured with a non-default secret.
   - Validates `PORT` and `DATABASE_URL` structure.
   - **Zero Secret Leaks**: The self-check never outputs or exposes environment variable values in logs.
3. **Fail-Fast Exit:**
   If any file or variable is missing, the container exits immediately with code `1` and prints an actionable remediation banner in the Render deploy log.

---

## 5. Local Verification with Docker

To test and verify the exact container build locally before deploying to Render:

### Step 1: Build the Docker Image
```bash
docker build -t trovi .
```

### Step 2: Run the Container with Environment File
```bash
docker run --rm -p 8000:8000 --env-file backend/.env trovi
```

### Step 3: Verify Container Health
In another terminal, test the health check endpoint:
```bash
curl http://localhost:8000/api/health
```

Expected JSON response:
```json
{
  "status": "healthy",
  "service": "Trovi Agent Backend",
  "database": "shopai.db",
  "environment": "development",
  "port": 8000,
  "version": "3.1.0",
  "currency": "INR",
  "catalog_source": "SQLite verified multi-category store"
}
```

### Step 4: Verify Store Policies
```bash
curl http://localhost:8000/api/policies
```

### Step 5: Test in Web Browser
Open [http://localhost:8000](http://localhost:8000) in your browser. The full Trovi storefront with live catalog, AI chat assistant, and customer portal should load cleanly.

---

## 6. CI Pipeline Protection

Every commit and pull request to `main` and `upgrade/production` is verified via GitHub Actions (`.github/workflows/ci.yml`):
- `backend-tests`: 135+ tests (security, idempotency, auth, order actions, startup self-check)
- `frontend-build`: Vite React bundle compilation
- `docker-smoke-test`: Builds the production Docker image, boots the container with minimal environment variables, and polls `/api/health` to guarantee no runtime files are missing before deployment.
