# ✉️ Trovi Runtime Transactional Templates

This directory houses HTML and text templates used by the Trovi backend notification engine at runtime (`backend/notifications.py`).

## Templates

### 1. `email/order_confirmation.html`
Sent immediately after order checkout when an email is provided:
- **Placeholders**: `{{customer_name}}`, `{{order_number}}`, `{{items_summary}}`, `{{total_price_inr}}`, `{{payment_method}}`, `{{shipping_address}}`, `{{estimated_delivery}}`.
- **Branding**: Trovi dark green header with order summary card and grievance contact info.

### 2. `email/status_update.html`
Dispatched on every order state transition (`placed` -> `packed` -> `shipped` -> `delivered` / `cancelled` / `returned`):
- **Placeholders**: `{{customer_name}}`, `{{order_number}}`, `{{status_title}}`, `{{status_badge}}`, `{{status_description}}`, `{{tracking_link}}`.
- **Features**: Visual status progress bar, return window notice, and customer support links.
