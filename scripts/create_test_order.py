import sys
import sqlite3
import os

if len(sys.argv) < 3:
    print("Usage: python create_test_order.py <email> <order_number> [status]")
    sys.exit(1)

email = sys.argv[1]
order_number = sys.argv[2]
status = sys.argv[3] if len(sys.argv) > 3 else "placed"

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.environ.get("SHOPI_DB_PATH", os.path.join(repo_root, "backend", "shopai.db"))
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT id, full_name FROM users WHERE email = ?", (email,))
row = c.fetchone()
if not row:
    print(f"Error: user {email} not found", file=sys.stderr)
    sys.exit(1)

user_id, full_name = row[0], row[1]
c.execute("""
    INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, items_summary, subtotal, subtotal_inr, delivery_fee, delivery_fee_inr, total_price, total_price_inr, status, payment_method, ordered_at)
    VALUES (?, ?, ?, ?, '12th Main, Indiranagar, Bengaluru - 560038', '1x Organic Forest Honey 500g', 4.5, 450, 0.5, 50, 5.0, 500, ?, 'UPI / QR', datetime('now'))
""", (order_number, user_id, full_name, email, status))
conn.commit()
conn.close()
print(f"Created order {order_number} for {email} with status {status}")
