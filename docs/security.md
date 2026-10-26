# Trovi Security Architecture & Operations Guide

This document describes the security policies, credential lifecycle management, admin account provisioning, and threat mitigations implemented across Trovi.

---

## 1. Authentication & Credential Architecture

Trovi implements a strict credential isolation and defense-in-depth model:
- **No Hardcoded Passwords**: All initial seed credentials, fixtures, and administrative passwords require explicit environment configuration or dynamic cryptographic generation.
- **Argon2 / BCrypt Password Hashing**: Passwords stored in the database are hashed with modern salted key derivation algorithms before persistence.
- **Session Tokens**: Stateless JSON Web Tokens (JWT) signed with `JWT_SECRET_KEY` (minimum 32 characters in production) with short access lifetimes (15 minutes) and dedicated refresh token rotation.
- **Role-Based Access Control (RBAC)**: All administrative endpoints (`/api/admin/*`) strictly verify the `admin` role claim and reject unprivileged customers with `403 Forbidden` and anonymous requests with `401 Unauthorized`.

---

## 2. Admin Account Provisioning & Password Rotation

Administrative accounts can be created and rotated via two supported methods:

### Method A: Interactive CLI via Render Shell or Terminal (`scripts/create_admin.py`)

If you have shell access or access to the **Shell** tab in the Render Dashboard for your web service:

```bash
# Refuses to run against production without explicit '--yes' confirmation
python scripts/create_admin.py --yes
```

**Features & Workflow:**
1. Securely prompts for the administrator's email and full name.
2. Uses `getpass` to prompt for the new password interactively with hidden input (passwords are **never** passed via CLI arguments or visible in the process table).
3. Prompts for password confirmation and validates length (minimum 8 characters).
4. If an account with that email already exists, it updates the user's role to `admin` and re-hashes/rotates the password in place.
5. If the account does not exist, it creates the administrator account.

---

### Method B: Rotating Admin Password via Render Dashboard Environment Variables

If you do not have terminal access to the production container:
1. Open the [Render Dashboard](https://dashboard.render.com).
2. Select your **Trovi** Web Service.
3. Click on the **Environment** tab in the left sidebar.
4. Locate `ADMIN_PASSWORD` (or click **Add Environment Variable** if not present).
5. Enter your new strong administrator password.
6. Set or add the environment variable `ADMIN_PASSWORD_RESET=true` (required: existing administrator passwords are never overwritten on startup unless this explicit reset flag is enabled).
7. Click **Save Changes**.
8. Render will trigger an automatic redeploy. On startup, `seed_database()` detects the updated environment variables and updates the administrator password hash in the database.
9. *(Recommended)* Once rotated in a persistent database (Postgres or persistent disk), remove `ADMIN_PASSWORD_RESET` (or set it to `false`) and remove `ADMIN_PASSWORD` from Render environment variables to minimize credential footprint.

---

## 3. Demo Accounts & Production Guardrails

To prevent test accounts from exposing production instances:
- The initial administrator account is created or synchronized **ONLY** from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. If they are not configured, admin creation is skipped and a warning is logged (there are zero hardcoded default credentials in every environment).
- Demo accounts (`admin@moss.internal`, `shopper@moss.internal`) are **only created** if BOTH of the following conditions are met:
  1. `ENVIRONMENT` / `APP_ENV` is set to `development` or `dev`.
  2. `DEMO_MODE=true` is explicitly configured.
- In development/demo mode, each demo account is generated with a fresh, cryptographically random password printed once to the backend stdout upon boot.
- Demo accounts are **never created in production**.
- **Production Startup Warning**: If `ENVIRONMENT=production` and any known demo accounts (`admin@moss.internal`, `shopper@moss.internal`) exist in the active database, the system logs a high-severity security warning upon startup banner.

> [!CAUTION]
> **Compromised Git History Notice:**
> The old demo passwords remain visible in git history and must be treated as compromised (change them everywhere they were used). Never reuse former default passwords (`Admin@123456`, `Shopper@123456`, `Admin@12345`, etc.) across any internal, staging, or production service. All former default credentials in git history are compromised and invalid.

---

## 4. How to Set Environment Variables on Render

To configure environment variables for your Trovi deployment in Render:

1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Navigate to your Trovi Web Service.
3. In the left-hand navigation menu, click **Environment**.
4. Click **Add Environment Variable** for each required variable:

| Variable Name | Recommended Value / Format | Purpose |
|---|---|---|
| `ENVIRONMENT` | `production` | Enables production security checks, hides tracebacks |
| `DEMO_MODE` | `false` | Disables demo account generation |
| `JWT_SECRET_KEY` | *(Random 64-char string)* | Cryptographically signs authentication tokens |
| `ADMIN_EMAIL` | `admin@yourdomain.com` | Initial admin email address |
| `ADMIN_PASSWORD` | *(Strong unique password)* | Initial admin password (hashed on startup) |
| `ADMIN_PASSWORD_RESET` | `false` | Explicit flag required to reset existing admin password (`true`/`false`) |
| `SHOPI_DB_PATH` | `/data/shopai.db` | Persistent disk mount path for SQLite |
| `DATABASE_URL` | *(Postgres connection URL)* | Managed PostgreSQL instance URL (if using PG) |
| `CORS_ORIGINS` | `https://your-frontend.onrender.com` | Restricts allowed API origins |

5. Click **Save Changes** at the bottom of the page. Render will automatically deploy a new build with the updated configuration.

---

## 5. Automated CI Secret Scanning

The CI pipeline (`.github/workflows/ci.yml`) runs automated secret scanning on every push and pull request:
- Scanner: `trufflesecurity/trufflehog-actions-scan@v3`
- Configured with `extra_args: --only-verified` to detect and block committed keys, tokens, or credential leaks.

