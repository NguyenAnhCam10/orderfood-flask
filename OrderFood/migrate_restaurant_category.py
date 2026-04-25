import os
from urllib.parse import unquote, urlparse

import pymysql
from dotenv import load_dotenv


def main():
    load_dotenv(".env")
    uri = os.environ.get("SQLALCHEMY_DATABASE_URI")
    if not uri:
        raise RuntimeError("SQLALCHEMY_DATABASE_URI is not configured")

    parsed = urlparse(uri)
    conn = pymysql.connect(
        host=parsed.hostname or "localhost",
        user=parsed.username,
        password=unquote(parsed.password or ""),
        database=parsed.path.lstrip("/"),
        port=parsed.port or 3306,
        charset="utf8mb4",
        autocommit=False,
    )

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS restaurant_category (
                    restaurant_category_id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL UNIQUE,
                    slug VARCHAR(100) NOT NULL UNIQUE,
                    INDEX ix_restaurant_category_slug (slug)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )

            cur.execute("SHOW COLUMNS FROM restaurant LIKE 'restaurant_category_id'")
            if not cur.fetchone():
                cur.execute("ALTER TABLE restaurant ADD COLUMN restaurant_category_id INT NULL")
                cur.execute(
                    "CREATE INDEX ix_restaurant_restaurant_category_id "
                    "ON restaurant (restaurant_category_id)"
                )

            for name, slug in [("Viet", "Viet"), ("Nhat", "Nhat")]:
                cur.execute(
                    "INSERT IGNORE INTO restaurant_category (name, slug) VALUES (%s, %s)",
                    (name, slug),
                )

            cur.execute("SELECT restaurant_category_id FROM restaurant_category WHERE slug='Viet'")
            viet_id = cur.fetchone()[0]
            cur.execute("SELECT restaurant_category_id FROM restaurant_category WHERE slug='Nhat'")
            nhat_id = cur.fetchone()[0]

            cur.execute(
                "UPDATE restaurant SET restaurant_category_id=%s "
                "WHERE restaurant_category_id IS NULL AND address LIKE 'Capichi - Viet%%'",
                (viet_id,),
            )
            cur.execute(
                "UPDATE restaurant SET restaurant_category_id=%s "
                "WHERE restaurant_category_id IS NULL AND address LIKE 'Capichi - Nhat%%'",
                (nhat_id,),
            )

        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
