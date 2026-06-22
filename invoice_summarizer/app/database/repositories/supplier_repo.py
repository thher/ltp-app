from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import Supplier, SupplierAlias


class SupplierRepository:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    # ── Suppliers ─────────────────────────────────────────────────────

    def save(self, supplier: Supplier) -> Supplier:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT INTO suppliers
                    (canonical_name, normalized_key, category_id, country, vat_number)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    supplier.canonical_name,
                    supplier.normalized_key,
                    supplier.category_id,
                    supplier.country,
                    supplier.vat_number,
                ),
            )
            supplier.id = cursor.lastrowid
        return supplier

    def find_by_id(self, supplier_id: int) -> Optional[Supplier]:
        row = self.db.fetchone(
            "SELECT * FROM suppliers WHERE id = ?", (supplier_id,)
        )
        return self._row_to_model(row) if row else None

    def find_by_normalized_key(self, key: str) -> Optional[Supplier]:
        row = self.db.fetchone(
            "SELECT * FROM suppliers WHERE normalized_key = ?", (key,)
        )
        return self._row_to_model(row) if row else None

    def find_all(self) -> list[Supplier]:
        rows = self.db.fetchall(
            "SELECT * FROM suppliers ORDER BY canonical_name"
        )
        return [self._row_to_model(r) for r in rows]

    def find_by_category(self, category_id: int) -> list[Supplier]:
        rows = self.db.fetchall(
            "SELECT * FROM suppliers WHERE category_id = ? ORDER BY canonical_name",
            (category_id,),
        )
        return [self._row_to_model(r) for r in rows]

    def update(self, supplier: Supplier) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                UPDATE suppliers
                SET canonical_name = ?, normalized_key = ?, category_id = ?,
                    country = ?, vat_number = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    supplier.canonical_name,
                    supplier.normalized_key,
                    supplier.category_id,
                    supplier.country,
                    supplier.vat_number,
                    supplier.id,
                ),
            )

    def delete(self, supplier_id: int) -> None:
        with self.db.transaction():
            self.db.execute(
                "DELETE FROM suppliers WHERE id = ?", (supplier_id,)
            )

    def count(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM suppliers") or 0

    # ── Aliases ───────────────────────────────────────────────────────

    def add_alias(self, alias: SupplierAlias) -> SupplierAlias:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT OR IGNORE INTO supplier_aliases
                    (supplier_id, alias, source, confidence)
                VALUES (?, ?, ?, ?)
                """,
                (alias.supplier_id, alias.alias, alias.source, alias.confidence),
            )
            alias.id = cursor.lastrowid
        return alias

    def find_aliases(self, supplier_id: int) -> list[SupplierAlias]:
        rows = self.db.fetchall(
            "SELECT * FROM supplier_aliases WHERE supplier_id = ?", (supplier_id,)
        )
        return [
            SupplierAlias(
                id=r["id"],
                supplier_id=r["supplier_id"],
                alias=r["alias"],
                source=r["source"],
                confidence=r["confidence"],
            )
            for r in rows
        ]

    def find_by_alias(self, alias: str) -> Optional[Supplier]:
        """Look up a supplier by one of its aliases (exact match)."""
        row = self.db.fetchone(
            """
            SELECT s.* FROM suppliers s
            JOIN supplier_aliases a ON a.supplier_id = s.id
            WHERE a.alias = ?
            """,
            (alias,),
        )
        return self._row_to_model(row) if row else None

    # ── Merge ─────────────────────────────────────────────────────────

    def merge(self, source_id: int, target_id: int) -> None:
        """Re-point all invoices and aliases from source to target, then delete source."""
        with self.db.transaction():
            self.db.execute(
                "UPDATE invoices SET supplier_id = ? WHERE supplier_id = ?",
                (target_id, source_id),
            )
            self.db.execute(
                "UPDATE supplier_aliases SET supplier_id = ? WHERE supplier_id = ?",
                (target_id, source_id),
            )
            self.db.execute(
                "DELETE FROM suppliers WHERE id = ?", (source_id,)
            )

    @staticmethod
    def _row_to_model(row) -> Supplier:
        return Supplier(
            id=row["id"],
            canonical_name=row["canonical_name"],
            normalized_key=row["normalized_key"],
            category_id=row["category_id"],
            country=row["country"],
            vat_number=row["vat_number"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
