from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import LineItem


class LineItemRepository:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def save(self, item: LineItem) -> LineItem:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT INTO line_items
                    (invoice_id, product_id, raw_description, quantity, unit,
                     unit_price, line_total, vat_rate, vat_amount,
                     length_per_unit, total_length,
                     confidence, needs_review)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.invoice_id,
                    item.product_id,
                    item.raw_description,
                    item.quantity,
                    item.unit,
                    item.unit_price,
                    item.line_total,
                    item.vat_rate,
                    item.vat_amount,
                    item.length_per_unit,
                    item.total_length,
                    item.confidence,
                    int(item.needs_review),
                ),
            )
            item.id = cursor.lastrowid
        return item

    def save_many(self, items: list[LineItem]) -> list[LineItem]:
        for item in items:
            self.save(item)
        return items

    def find_by_invoice(self, invoice_id: int) -> list[LineItem]:
        rows = self.db.fetchall(
            "SELECT * FROM line_items WHERE invoice_id = ?", (invoice_id,)
        )
        return [self._row_to_model(r) for r in rows]

    def find_needs_review(self) -> list[LineItem]:
        rows = self.db.fetchall(
            "SELECT * FROM line_items WHERE needs_review = 1"
        )
        return [self._row_to_model(r) for r in rows]

    def find_aggregated(
        self, supplier_id: Optional[int] = None
    ) -> list[dict]:
        """Return line items aggregated by supplier + normalized description.

        Each dict has: supplier_name, raw_description, unit, total_quantity,
        total_length_m, total_spend, occurrences, needs_review.

        total_length_m is non-NULL only when every row in the group has a
        total_length value (i.e. the bundle prefix was detected for all rows).
        When present it should be used for aggregation instead of total_quantity.
        """
        base = """
            SELECT
                COALESCE(s.canonical_name, '—') AS supplier_name,
                li.raw_description,
                li.unit,
                SUM(COALESCE(li.quantity, 0))             AS total_quantity,
                SUM(li.total_length)                       AS total_length_m,
                SUM(COALESCE(li.line_total, 0))           AS total_spend,
                COUNT(*)                                   AS occurrences,
                MAX(li.needs_review)                       AS needs_review
            FROM line_items li
            JOIN invoices i ON li.invoice_id = i.id
            LEFT JOIN suppliers s ON i.supplier_id = s.id
        """
        if supplier_id is not None:
            sql = (
                base
                + " WHERE i.supplier_id = ?"
                + " GROUP BY i.supplier_id, LOWER(TRIM(li.raw_description))"
                + " ORDER BY total_spend DESC"
            )
            rows = self.db.fetchall(sql, (supplier_id,))
        else:
            sql = (
                base
                + " GROUP BY COALESCE(i.supplier_id, -1), LOWER(TRIM(li.raw_description))"
                + " ORDER BY supplier_name, total_spend DESC"
            )
            rows = self.db.fetchall(sql)
        return [dict(r) for r in rows]

    def count(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM line_items") or 0

    @staticmethod
    def _row_to_model(row) -> LineItem:
        return LineItem(
            id=row["id"],
            invoice_id=row["invoice_id"],
            product_id=row["product_id"],
            raw_description=row["raw_description"],
            quantity=row["quantity"],
            unit=row["unit"],
            unit_price=row["unit_price"],
            line_total=row["line_total"],
            vat_rate=row["vat_rate"],
            vat_amount=row["vat_amount"],
            length_per_unit=row["length_per_unit"],
            total_length=row["total_length"],
            confidence=row["confidence"],
            needs_review=bool(row["needs_review"]),
        )
