"""
Manual migration helpers (thay cho Flask-Migrate).
Mỗi migration là một hàm, được gọi tuần tự trong run_migrations().
db.create_all() chỉ tạo bảng mới — file này xử lý ALTER TABLE cho bảng đã tồn tại.
"""
from sqlalchemy import inspect, text


def _existing_columns(engine, table: str) -> set:
    return {c["name"] for c in inspect(engine).get_columns(table)}


def _add_column_if_missing(conn, engine, table: str, column: str, definition: str):
    if column not in _existing_columns(engine, table):
        conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN {column} {definition}"))
        print(f"[migrate] Added column `{table}`.{column}")


# ─────────────────────────────────────────────
# Danh sách migrations — thêm hàm mới vào đây
# ─────────────────────────────────────────────

def m001_order_delivery_address(conn, engine):
    """Task 2 — địa chỉ giao hàng."""
    _add_column_if_missing(conn, engine, "order", "delivery_address", "VARCHAR(255) NULL")


def m002_order_shipping_tax(conn, engine):
    """Task 5 — phí ship và thuế."""
    _add_column_if_missing(conn, engine, "order", "shipping_fee", "FLOAT NOT NULL DEFAULT 0")
    _add_column_if_missing(conn, engine, "order", "tax_amount",   "FLOAT NOT NULL DEFAULT 0")


def m003_backfill_customer_records(conn, engine):
    """Tạo Customer record cho các user CUSTOMER đã tồn tại nhưng thiếu record."""
    result = conn.execute(text(
        "SELECT COUNT(*) FROM user u "
        "WHERE u.role = 'CUSTOMER' "
        "AND NOT EXISTS (SELECT 1 FROM customer c WHERE c.user_id = u.user_id)"
    ))
    missing = result.scalar()
    if missing:
        conn.execute(text(
            "INSERT INTO customer (user_id) "
            "SELECT user_id FROM user "
            "WHERE role = 'CUSTOMER' "
            "AND user_id NOT IN (SELECT user_id FROM customer)"
        ))
        print(f"[migrate] Backfilled {missing} missing Customer record(s)")


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

_MIGRATIONS = [
    m001_order_delivery_address,
    m002_order_shipping_tax,
    m003_backfill_customer_records,
]


def run_migrations(db):
    """Gọi trong create_app() sau db.create_all()."""
    try:
        with db.engine.connect() as conn:
            for fn in _MIGRATIONS:
                fn(conn, db.engine)
            conn.commit()
    except Exception as e:
        print(f"[migrate] Error: {e}")
