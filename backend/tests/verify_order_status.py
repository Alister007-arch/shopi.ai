import sys
import sqlite3
import os

if len(sys.argv) < 3:
    print("Usage: python verify_order_status.py <order_number> <expected_status>")
    sys.exit(1)

order_number = sys.argv[1]
expected_status = sys.argv[2]

db_path = os.environ.get("SHOPI_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopai.db"))
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("SELECT status FROM orders WHERE order_number = ?", (order_number,))
row = c.fetchone()
conn.close()

if not row:
    print(f"Error: order {order_number} not found", file=sys.stderr)
    sys.exit(1)

status = row[0]
if status != expected_status:
    print(f"Expected status {expected_status} but got {status}", file=sys.stderr)
    sys.exit(2)

print(f"Verified order {order_number} has status {expected_status}")
