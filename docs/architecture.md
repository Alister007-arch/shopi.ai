# Trovi — System Architecture & Design Specification

This document details the architectural principles, component interactions, safety boundaries, and technical decisions governing the **Trovi** autonomous e-commerce platform.

---

## 1. System Overview & Philosophy

Trovi marries a high-touch, editorial storefront aesthetic with an autonomous conversational commerce engine. The system balances frictionless AI assistance with strict transactional integrity:
- **Zero Hallucination Orders**: The AI agent can *never* unilaterally debit funds or commit database state without user confirmation.
- **Cryptographic Trust**: Orders originated via chat must present a tamper-proof HMAC-SHA256 quote token signed by the backend.
- **Absolute Inventory Safety**: Flash-sale concurrency is protected via atomic database row-level locking (`BEGIN IMMEDIATE`) preventing stock overselling.
- **Regulatory Compliance**: Integrated GST invoicing with reverse calculation (CGST/SGST) and HSN taxonomy.

---

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Client["Frontend Client (React 19 + Vite)"]
        UI_Storefront["Trovi Storefront (Catalog, WebP, A11y)"]
        UI_Drawer["Cart & Orders Drawer (Saved Addresses, Delivery Slots)"]
        UI_Chat["AI Concierge Chat (Quote Token Confirmation Modal)"]
        UI_Admin["Enterprise Admin Dashboard (Metrics, Catalog CRUD, Traces)"]
    end

    subgraph Gateway["FastAPI Application Gateway"]
        MW_Tracing["Request ID Correlation Middleware"]
        MW_CORS["Strict CORS Middleware"]
        MW_Auth["JWT Authentication & RBAC (Customer vs Admin)"]
        MW_Idemp["Idempotency Filter (Header: Idempotency-Key)"]
    end

    subgraph AgentCore["Agent & Safety Layer"]
        Guard_Injection["Prompt Injection & Jailbreak Defense"]
        Guard_Budget["Code-Level Budget Gatekeeper"]
        Engine_Quote["Cryptographic Quote Token Service (HMAC-SHA256, 15m Expiry)"]
        Engine_LangGraph["LangGraph Multi-Tool Decision Graph"]
        Trace_Logger["Agent Execution Trace Recorder (agent_traces)"]
    end

    subgraph BusinessCore["Commerce Core Services"]
        Svc_Catalog["Catalog Service (Search, Category Facets, Reviews)"]
        Svc_Orders["Order Lifecycle State Machine (placed -> packed -> shipped -> delivered)"]
        Svc_Stock["Atomic Stock Decrement (BEGIN IMMEDIATE)"]
        Svc_Invoice["GST Tax Invoice Generator (CGST/SGST, HSN, Printable HTML)"]
        Svc_Payments["Pluggable Payment Gateway (UPI, Card, COD, Razorpay)"]
        Svc_Notify["Multi-Channel Notifications (Email, SMS, WhatsApp)"]
    end

    subgraph Storage["Data Persistence"]
        DB_SQLite["SQLite 3 (Development / WAL Mode)"]
        DB_Postgres["PostgreSQL 16 (Production Relational Target)"]
    end

    Client --> Gateway
    Gateway --> AgentCore
    Gateway --> BusinessCore
    AgentCore --> Engine_Quote
    AgentCore --> BusinessCore
    BusinessCore --> Svc_Stock
    BusinessCore --> Storage
```

---

## 3. The Two-Step Agent Safety Boundary

To prevent unauthorized order placement, price drift, or prompt-injection exploitation, Trovi enforces a **Two-Step Cryptographic Quote Pattern**:

```mermaid
sequenceDiagram
    autonumber
    actor User as Customer
    participant Frontend as React Storefront
    participant Agent as LangGraph Agent
    participant Safety as Safety & Quote Service
    participant Orders as Orders & Stock Engine

    User->>Frontend: "I want 2 jars of Raw Wild Honey under ₹1200"
    Frontend->>Agent: POST /api/chat {message, session_id}
    Agent->>Safety: Evaluate Budget (Limit: ₹1200) & Sanitize
    Safety-->>Agent: Passed Guardrails
    Agent->>Safety: generate_quote_token(items, total_inr)
    Safety->>Safety: Compute HMAC-SHA256(items + total + timestamp)
    Safety-->>Agent: quote_token (valid for 15 minutes)
    Agent-->>Frontend: Returns items breakdown + quote_token + "Requires Confirmation"
    Frontend->>User: Displays Verified Quote Card with [Confirm Order] button
    User->>Frontend: Clicks [Confirm Order]
    Frontend->>Orders: POST /api/order/confirm-quote {quote_token, address, payment_method}
    Orders->>Safety: verify_quote_token(quote_token)
    Safety-->>Orders: Token Valid & Within 15-minute window
    Orders->>Orders: BEGIN IMMEDIATE -> Atomic Stock Decrement
    Orders-->>Frontend: Order Placed Successfully (HTTP 200)
    Frontend->>User: Renders Order Confirmation & GST Tax Invoice
```

### Key Security Properties:
1. **Cryptographic Integrity**: The token encodes item IDs, quantities, and agreed prices signed with `QUOTE_TOKEN_SECRET`. Any client tampering invalidates the signature.
2. **Replay Defense**: Once confirmed, the token is recorded in `agent_quotes` with `is_confirmed = 1`. Subsequent reuse attempts fail immediately.
3. **Time-Bound**: Expired tokens (>15 minutes) reject with `QUOTE_EXPIRED` to prevent price drift and stale inventory reservations.

---

## 4. Concurrency & Flash-Sale Stock Lock Architecture

To eliminate the stock oversell bug present in demo apps, Trovi utilizes pessimistic serialized execution:

### SQLite Implementation
```sql
BEGIN IMMEDIATE;
-- Read-modify-write executed atomically
UPDATE products
SET stock = stock - :quantity
WHERE id = :product_id AND stock >= :quantity;

-- If cursor.rowcount == 0, stock was insufficient
-- Immediately ROLLBACK and abort checkout
```

### Concurrency Ordering Matrix
When an order contains multiple line items, product IDs are sorted numerically prior to acquisition (`sorted(item.product_id)`) to eliminate database deadlock conditions across concurrent threads.

---

## 5. Order State Machine & Lifecycle

Orders follow a deterministic state machine managed by `lifecycle.py`:

```mermaid
stateDiagram-v2
    [*] --> placed: Multi-Checkout or Quote Confirmation
    placed --> packed: Admin / Warehouse Packing
    packed --> shipped: Courier Dispatched (Tracking ID assigned)
    shipped --> delivered: Customer Handover Complete
    
    placed --> cancelled: Customer / Admin Cancellation (Restores Stock)
    packed --> cancelled: Cancellation (Restores Stock)
    shipped --> cancelled: Cancellation Rejected (In Transit)
    delivered --> [*]
    cancelled --> [*]
```

### Cancellation Invariant
When an order transitions to `cancelled`:
1. The transition is wrapped in an atomic database transaction.
2. Every item line in `order_items` executes an atomic stock replenishment:
   `UPDATE products SET stock = stock + :qty WHERE id = :product_id`.
3. An audit notification is triggered via Email and SMS confirming order termination and stock restoration.

---

## 6. Indian GST Tax Invoicing Subsystem

Indian e-commerce compliance mandates itemized GST tax invoices. Trovi features an integrated reverse-calculation invoice generator:

- **Formula**:
  $$\text{Taxable Value} = \frac{\text{Total Paid}}{1 + \text{GST Rate}}$$
  $$\text{Total GST} = \text{Total Paid} - \text{Taxable Value}$$
  $$\text{CGST} = \frac{\text{Total GST}}{2}, \quad \text{SGST} = \frac{\text{Total GST}}{2}$$
- **HSN Classification**: Trovi catalog includes assigned HSN codes (e.g., Honey: `0409`, Organic Oils: `1515`, Tea & Beverages: `0902`).
- **Export Formats**: Standard JSON response schema and print-ready standalone HTML invoices (`GET /api/order/{id}/invoice/html`).

---

## 7. Pluggable Payment Subsystem

Payment execution follows an abstract provider interface:

```python
class PaymentProvider(ABC):
    @abstractmethod
    def initiate_payment(self, order_id: int, amount_inr: float, metadata: dict) -> PaymentInitiationResult:
        ...

    @abstractmethod
    def verify_payment(self, payment_id: str, signature: str = None) -> PaymentVerificationResult:
        ...
```

### Supported Implementations:
1. `UPIPaymentProvider`: Simulates or connects to instant VPA / QR code intent routing.
2. `CardPaymentProvider`: Simulates 3D Secure card network authorization.
3. `CODPaymentProvider`: Cash-on-Delivery with zero upfront debit and delivery collection verification.
4. `RazorpayPaymentProvider`: Production-ready Razorpay checkout SDK integration using HMAC-SHA256 signature verification.

---

## 8. Multi-Channel Notification Dispatch

The notification service (`backend/app/notifications/service.py`) provides asynchronous multi-channel fanout:
- **Email**: Dispatches HTML transactional templates for Order Placed, Shipped, Delivered, and Invoices.
- **SMS**: Dispatches high-urgency transactional SMS with order IDs and OTPs.
- **WhatsApp**: Dispatches conversational notifications via WhatsApp Business API templates.
- **Audit Logging**: Every dispatched notification is persisted in the `notifications` table with status (`sent`, `failed`, `queued`).

---

## 9. Evaluation & Benchmarking Infrastructure

To prevent regressions in agent reasoning and conversational commerce, the repository houses an automated eval suite:
- **60 Automated Conversation Benchmarks** across 6 distinct evaluation domains:
  1. Safe Order Execution & Confirmation
  2. Budget & Overrun Enforcement
  3. Prompt Injection & Jailbreak Neutralization
  4. Catalog Filtering & Facet Recommendation
  5. Multi-Item Order Quoting
  6. Out-of-Stock & Error Resolution
- **Continuous Integration**: Executed automatically on every pull request and push to `upgrade/production`.

---
*Authored by Trovi Architecture & Core Infrastructure Engineering.*
