from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import Product, ProductAlias


class ProductRepository:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def save(self, product: Product) -> Product:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT INTO products (canonical_name, normalized_key, category, unit)
                VALUES (?, ?, ?, ?)
                """,
                (
                    product.canonical_name,
                    product.normalized_key,
                    product.category,
                    product.unit,
                ),
            )
            product.id = cursor.lastrowid
        return product

    def find_by_id(self, product_id: int) -> Optional[Product]:
        row = self.db.fetchone(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        )
        return self._row_to_model(row) if row else None

    def find_by_normalized_key(self, key: str) -> Optional[Product]:
        row = self.db.fetchone(
            "SELECT * FROM products WHERE normalized_key = ?", (key,)
        )
        return self._row_to_model(row) if row else None

    def find_all(self) -> list[Product]:
        rows = self.db.fetchall(
            "SELECT * FROM products ORDER BY canonical_name"
        )
        return [self._row_to_model(r) for r in rows]

    def count(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM products") or 0

    def add_alias(self, alias: ProductAlias) -> ProductAlias:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT OR IGNORE INTO product_aliases (product_id, alias, source)
                VALUES (?, ?, ?)
                """,
                (alias.product_id, alias.alias, alias.source),
            )
            alias.id = cursor.lastrowid
        return alias

    def find_by_alias(self, alias: str) -> Optional[Product]:
        row = self.db.fetchone(
            """
            SELECT p.* FROM products p
            JOIN product_aliases a ON a.product_id = p.id
            WHERE a.alias = ?
            """,
            (alias,),
        )
        return self._row_to_model(row) if row else None

    @staticmethod
    def _row_to_model(row) -> Product:
        return Product(
            id=row["id"],
            canonical_name=row["canonical_name"],
            normalized_key=row["normalized_key"],
            category=row["category"],
            unit=row["unit"],
            created_at=row["created_at"],
        )
