# Trovi — Production Operations Runbook

This document defines the operational runbook, deployment standards, configuration reference, and disaster recovery procedures for **Trovi**, an enterprise-grade autonomous e-commerce platform powered by FastAPI, React 19, LangGraph, and Groq.

---

## 1. Architecture & Service Topology

```
+-------------------------------------------------------------------------+
|                              Client Layer                               |
|        React 19 + Vite Storefront (Trovi Editorial Aesthetic)           |
|       - Section 6B Responsive Catalog Grid (WebP <60KB, WCAG AA)        |
|       - Cart & Orders Drawer Modal (Saved Addresses, Delivery Slots)    |
|       - Natural Language AI Concierge & Image Visual Search             |
|       - Enterprise Admin Console (/api/admin)                           |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTPS / REST / SSE
                                     v
+------------------------------------+------------------------------------+
|                         Application Gateway                             |
|                        FastAPI (Python 3.11+)                           |
|       - Request ID Tracing Middleware (X-Request-ID)                    |
|       - Strict Origin CORS Enforcement                                  |
|       - JWT Authentication & Role-Based Access Control                  |
|       - Idempotency Key Deduplication Layer                             |
+------------------+-----------------------------+------------------------+
                   |                             |
                   v                             v
+------------------+---------+     +-------------+------------------------+
|      Agent Safety Layer    |     |          Core Business APIs          |
| - Prompt Injection Defense |     | - Catalog Browsing & Facets          |
| - Budget Enforcement Policy|     | - Atomic Stock Decrement / BEGIN IMM |
| - HMAC-SHA256 Quote Tokens |     | - Order State Machine & Lifecycle    |
| - Agent Traces & Latency   |     | - Pluggable Payments (UPI/Card/COD)  |
| - 60-Eval Automated Suite  |     | - GST Tax Invoice Generation         |
+------------------+---------+     +-------------+------------------------+
                   |                             |
                   +--------------+--------------+
                                  |
                                  v
+---------------------------------+---------------------------------------+
|                           Data Layer                                    |
|   - Production: PostgreSQL 16 (Relational Schema, Foreign Keys)         |
|   - Local Dev: SQLite with WAL mode & BEGIN IMMEDIATE                   |
|   - Queue / Notifications: In-Memory / Redis Channel Dispatch           |
+-------------------------------------------------------------------------+
```

---

## 2. Quickstart & Local Development

### Prerequisites
- Python 3.11+ (Python 3.12 / 3.13 supported)
- Node.js 20+ & npm 10+
- (Optional) Docker & Docker Compose for PostgreSQL 16 + Redis 7

### Backend Setup
```bash
# 1. Navigate to workspace root
cd /path/to/trovi

# 2. Configure Python environment & install requirements
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your GROQ_API_KEY, JWT_SECRET, etc.

# 4. Initialize database and seed 77 catalog products
python backend/setup_db.py

# 5. Start the backend development server
cd backend
python main.py
# Server will listen on http://localhost:8000
```

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd /path/to/trovi/frontend

# 2. Install dependencies
npm install

# 3. Start Vite development server
npm run dev
# Frontend will be live on http://localhost:5173
```

---

## 3. Configuration & Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | **Yes** (for LLM) | `""` | Groq API Key for Llama-3.3-70b & Llama-Vision-90b inference. Falls back to deterministic keyword engine if unset. |
| `DATABASE_URL` | No | `sqlite:///backend/shopai.db` | PostgreSQL connection string (`postgresql://user:pass@host:5432/moss_db`) or local SQLite path. |
| `JWT_SECRET_KEY` | No | `moss-super-secret-jwt-key-2026-production` | Secret key used to sign and verify HS256 authentication tokens. |
| `JWT_ALGORITHM` | No | `HS256` | Token hashing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Duration in minutes before access token expiration. |
| `QUOTE_TOKEN_SECRET` | No | `moss-quote-token-hmac-secret-production-2026` | Secret key for generating cryptographic HMAC-SHA256 agent quote tokens. |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed origins. Wildcards (`*`) are strictly blocked in production. |
| `PORT` | No | `8000` | Port for the Uvicorn web server. |

---

## 4. Database Migrations & Data Hydration

### SQLite Development Database
```bash
# Rebuild local SQLite catalog from scratch:
python backend/setup_db.py
```

### PostgreSQL Migration
```bash
# 1. Spin up local PostgreSQL container:
docker-compose up -d postgres redis

# 2. Run Alembic migrations:
alembic upgrade head

# 3. Migrate SQLite catalog into PostgreSQL:
python scripts/migrate_sqlite_to_pg.py
```

---

## 5. Deployment Procedures

### Single-Container Production Docker Build
The repository provides a unified multi-stage `Dockerfile` that builds the React frontend assets and bundles them into the FastAPI application container:
```bash
# Build production Docker image:
docker build -t moss-ecommerce:latest .

# Run container:
docker run -p 8000:8000 \
  -e GROQ_API_KEY="your-groq-key" \
  -e JWT_SECRET_KEY="production-secret" \
  moss-ecommerce:latest
```

### PaaS Deployment (Render / Railway)
- **Root Directory**: `.`
- **Build Command**: `./build.sh` (installs backend packages, runs Vite build, seeds DB)
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

---

## 6. Comprehensive Verification & Testing

Every deployment must pass all test suites before release:

```bash
# 1. Run full Pytest suite (41+ tests: Concurrency, Idempotency, Safety, Security, Admin, Auth):
$env:PYTHONPATH=".;backend"; python -m pytest backend/tests/ -v

# 2. Run Agent 60-Evaluation Benchmark Suite (100% pass across 6 domains):
python evals/run_evals.py

# 3. Run Legacy Integration Suite:
python backend/test_suite.py

# 4. Verify Frontend Production Build:
cd frontend && npm run build
```

---

## 7. Incident Response & Disaster Recovery

### Incident 1: Groq API Outage / Rate Limits (HTTP 429 / 503)
- **Symptom**: Chat agent logs show timeout or rate limit errors from Groq endpoint.
- **Remedy**: The backend is architected with a deterministic fallback engine. When Groq returns an error, the agent gracefully falls back to structured keyword matching and catalog intent resolution.
- **Monitoring**: Check `/api/admin/metrics` for LLM failure counts and latency percentiles.

### Incident 2: Stock Oversell Contention Under Flash Sales
- **Symptom**: High volume of concurrent checkouts for limited inventory items.
- **Protection**: `tools.py` executes `BEGIN IMMEDIATE` and uses atomic condition `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`. If `rowcount == 0`, the transaction rolls back cleanly with HTTP 400 `insufficient stock`.
- **Restocking**: Administrators can replenish stock instantly via:
  ```bash
  curl -X POST http://localhost:8000/api/admin/inventory/adjust \
    -H "Content-Type: application/json" \
    -d '{"product_id": 1, "quantity_delta": 50, "reason": "Flash sale inventory restock"}'
  ```

### Incident 3: Expired Quote Token Rejection
- **Symptom**: Customer receives `QUOTE_EXPIRED` (HTTP 400) when placing an AI order.
- **Cause**: Quote tokens are bound to a 15-minute cryptographic expiration window to prevent price drift and inventory lockup.
- **Action**: Advise the customer to re-confirm the cart in chat to generate a fresh quote token.

---

## 8. Observability & Administrative Audits

### Monitoring Endpoints
- **System Metrics**: `GET /api/admin/metrics` (Total orders, revenue, inventory health, agent latency, notification success rate).
- **Execution Traces**: `GET /api/admin/traces` (Full audit log of agent conversations, tool invocations, tokens used, latency).
- **Notifications Log**: `GET /api/admin/notifications` (Delivery status across Email, SMS, WhatsApp channels).
- **Health Check**: `GET /api/health` (Uptime, database connectivity status).

---
*Maintained by Trovi Platform Engineering & Security Operations Team.*
