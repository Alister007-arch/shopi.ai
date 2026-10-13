## Summary of Changes
<!-- Provide a brief description of the changes and motivation for this PR -->

---

## Pre-Merge Verification Checklist
Please ensure all items below are confirmed prior to merging into `main`:

- [ ] **Tests pass**: Backend pytest test suite (100% pass), agent evaluation benchmarks (60/60 evals), and frontend build pass.
- [ ] **No secrets**: No `.env`, `*.db`, real credentials, private keys, or passwords committed or staged (verified with TruffleHog / secret scanning).
- [ ] **Docs updated**: Architecture, security runbooks (`docs/security.md`), Render deploy instructions (`docs/deploy-render.md`), and README.md accurately reflect all changes.
- [ ] **Docker build passes**: Local Docker build succeeds (`docker build -t trovi .`) and container responds healthy to `/api/health`.

---

## Deployment & Verification Notes
<!-- Detail testing instructions, required environment variables, or rollback precautions -->
- **Target Branch**: `main`
- **Fast-Forward Compatible**: Yes
- **Render Deployment Impact**: Requires persistent disk mount (`SHOPI_DB_PATH=/data/shopai.db`) or managed PostgreSQL (`DATABASE_URL`).
