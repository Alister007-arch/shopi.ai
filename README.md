# 🛍️ Trovi — Bolo, Trovi dhoond dega. (Ask. Compare. Buy.)

[![CI Pipeline](https://github.com/Alister007-arch/shopi.ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Alister007-arch/shopi.ai/actions)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic_Flow-FF6F00)](https://langchain.com)
[![Pytest](https://img.shields.io/badge/Pytest-Multi_Category-green)](https://pytest.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Trovi** is an enterprise-grade, multi-category AI commerce platform spanning 7 premier departments: **Grocery, Fashion, Electronics, Laptops, Home & Kitchen, Personal Care, and Luxury**. Featuring **MOSS Organics** as a dedicated sub-brand collection for organic farm-to-table groceries, Trovi pairs high-aesthetic editorial storefront design with **Trovi AI** ("Ask Trovi"), an autonomous conversational commerce assistant powered by FastAPI, React 19, LangGraph, and Groq LLMs.

---

## 🌟 Core Capabilities & Multi-Category Architecture

### 1. 🗂️ 7-Department Category Hierarchy & Dynamic Attribute Schemas
- **Department Tree**: Hierarchical categories table with parent/child relationships across Grocery, Fashion, Electronics, Laptops, Home & Kitchen, Personal Care, and Luxury (40 leaf categories).
- **Category-Specific Policy Groups**: Every category maps to dedicated policy groups (`packaged_food`, `fresh_produce`, `personal_care`, `clothing`, `innerwear`, `electronics`, `laptops`, `home_kitchen`, `luxury`, `default`).
- **High-Value Laptop Policy**: Laptops require replacement-first resolution, mandatory technical inspection, and human review authorization.
- **Dynamic Attribute Filtering**: JSON product schemas supporting category-specific facet filtering (RAM & SSD for laptops, Size & Fabric for fashion, Pack size & Organic certification for grocery, Warranty for tech).
- **Verified Organic Claims**: "Certified organic" and "zero additives" trust claims are strictly restricted to products where `is_organic: true`.

### 2. 🤖 Category-Aware Agentic AI Shopping Assistant
- **Intent Disambiguation**: Intelligently clarifies ambiguous queries across categories (e.g., distinguishing "apple" fruit in grocery vs "Apple MacBook" in laptops).
- **Category-Specific Evaluation**:
  - *Grocery*: Recommends by price per 100g, purity, and organic certification.
  - *Laptops*: Compares CPU, RAM, storage, battery life, and warranty.
  - *Fashion*: Analyzes fit, fabric composition, care instructions, and return policy.
- **Strict Domain Boundaries**: Never cross-recommends items across unrelated categories without explicit request.
- **Bilingual Fluency**: Native support for English and Hinglish queries ("Mujhe coding ke liye laptop chahiye", "Sabse accha pure honey konsa hai").

### 3. 🛡️ Agent Safety & Two-Step Cryptographic Quote Confirmation
- **Cryptographic Quote Tokens**: AI recommendations generate time-bound HMAC-SHA256 signed quote tokens with a 15-minute expiration window.
- **Explicit User Confirmation**: No funds or orders are committed without explicit customer approval via verified quote cards.
- **Budget Guardrails**: Hard, code-level budget limits strictly reject cart overruns without user authorization.
- **Prompt Injection Defense**: Multi-layered regex sanitization and system boundaries neutralize adversarial prompt-injection and jailbreak attempts.
- **Execution Traces**: Full database logging of agent latency, tool invocations, tokens consumed, and session diagnostics (`/api/admin/traces`).

### 4. ⚡ Concurrency & Flash-Sale Stock Safety
- **Zero Oversell Invariant**: Utilizes `BEGIN IMMEDIATE` pessimistic locking and atomic decrement conditions (`stock = stock - ? WHERE id = ? AND stock >= ?`).
- **Deadlock Avoidance**: Sorts product IDs numerically during multi-item checkouts to guarantee deadlock-free locking order.
- **Idempotency Protection**: Dedicated `idempotency_keys` table deduplicates duplicate requests originating from network retries.

### 5. 📦 Order Lifecycle, Invoicing & Payments
- **State Machine**: Deterministic transitions (`placed` $\to$ `packed` $\to$ `shipped` $\to$ `delivered`).
- **Atomic Cancellation**: Canceling an order automatically replenishes inventory in a single atomic transaction.
- **Indian GST Invoicing**: Reverse-calculates CGST/SGST tax components against HSN codes with print-ready HTML invoices (`/api/order/{id}/invoice/html`).
- **Pluggable Payments**: Extensible provider interface with support for UPI, Cards, Cash-on-Delivery, and production Razorpay signatures.

### 6. 🎨 Trovi Storefront & Mega Navigation
- **All-Department Mega Menu**: Quick navigation to all 7 departments and 40 curated categories.
- **Category-Aware Product Details**: Dynamic specs accordions, category-specific trust strips, and tailored return policies.
- **WebP Image Compression & Lazy Loading**: High-resolution WebP images with `loading="lazy"` and `decoding="async"`.
- **Admin CSV Import/Export**: Bulk catalog upload and download with per-category attributes.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.11+
- Node.js 20+ & npm 10+
- (Optional) Docker for PostgreSQL + Redis

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/Alister007-arch/shopi.ai.git trovi
cd trovi

# Install Python requirements
pip install -r backend/requirements.txt

# Initialize database with curated catalog products
python backend/setup_db.py

# Launch development server on port 8000
python backend/main.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Accessible at http://localhost:5173
```

---

## 🧪 Testing & Evaluation Benchmark Suite

The codebase maintains rigorous automated test suites across every layer:

```bash
# 1. Run all Pytest suites (41 tests: Safety, Concurrency, Idempotency, Security, Admin, Auth)
$env:PYTHONPATH=".;backend"; python -m pytest backend/tests/ -v

# 2. Run the 60-Evaluation Agent Benchmark Suite (100% deterministic pass)
python evals/run_evals.py

# 3. Run Legacy Integration Suite (12 tests)
python backend/test_suite.py

# 4. Verify Frontend Production Bundle Build
cd frontend && npm run build
```

---

## 📂 Documentation & Architecture Deep-Dive

For complete specifications, architecture diagrams, and operational procedures, see:
- 📖 [System Architecture Specification](docs/architecture.md)
- 🛠️ [Production Operations Runbook](docs/runbook.md)
- 📋 [Engineering Audit & Phased Roadmap](docs/audit_and_plan.md)

---

## 🐳 Docker Deployment

A multi-stage container is ready for production hosting on Render, Railway, or AWS:

```bash
# Build unified production image
docker build -t trovi-ecommerce:latest .

# Run with environment variables
docker run -p 8000:8000 \
  -e GROQ_API_KEY="your-groq-key" \
  -e JWT_SECRET_KEY="production-secret" \
  moss-ecommerce:latest
```

---
*Developed with mindful craftsmanship for high-integrity autonomous commerce.*
