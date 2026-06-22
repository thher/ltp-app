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
                     unit_type, normalized_quantity, material_category,
                     confidence, needs_review)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    item.unit_type,
                    item.normalized_quantity,
                    item.material_category,
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
                MAX(li.material_category)                  AS material_category,
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

    def find_material_summary(self) -> list[dict]:
        """Quantity + spend grouped by (material_category, unit_type).

        Never mixes incompatible units — each row covers one category/unit pair.
        Rows with null category/unit_type are excluded.
        """
        sql = """
            SELECT
                material_category,
                unit_type,
                SUM(COALESCE(normalized_quantity, 0)) AS total_quantity,
                SUM(COALESCE(line_total, 0))          AS total_spend,
                COUNT(*)                               AS item_count
            FROM line_items
            WHERE material_category IS NOT NULL
              AND unit_type IS NOT NULL
            GROUP BY material_category, unit_type
            ORDER BY total_spend DESC
        """
        return [dict(r) for r in self.db.fetchall(sql)]

    def find_spend_by_material(self) -> list[dict]:
        """Total spend per material category, ordered by spend."""
        sql = """
            SELECT
                material_category,
                SUM(COALESCE(line_total, 0)) AS total_spend,
                COUNT(*)                      AS item_count
            FROM line_items
            WHERE material_category IS NOT NULL
            GROUP BY material_category
            ORDER BY total_spend DESC
        """
        return [dict(r) for r in self.db.fetchall(sql)]

    def find_top_by_quantity(self, limit: int = 50) -> list[dict]:
        """Top products ranked by normalized_quantity, grouped by description + unit."""
        sql = """
            SELECT
                raw_description,
                material_category,
                unit_type,
                SUM(COALESCE(normalized_quantity, 0)) AS total_quantity,
                SUM(COALESCE(line_total, 0))          AS total_spend,
                COUNT(*)                               AS occurrences
            FROM line_items
            WHERE normalized_quantity IS NOT NULL AND normalized_quantity > 0
              AND unit_type IS NOT NULL
            GROUP BY LOWER(TRIM(raw_description)), unit_type
            ORDER BY total_quantity DESC
            LIMIT ?
        """
        return [dict(r) for r in self.db.fetchall(sql, (limit,))]

    def find_top_by_spend(self, limit: int = 50) -> list[dict]:
        """Top products ranked by spend, grouped by description."""
        sql = """
            SELECT
                raw_description,
                material_category,
                unit_type,
                SUM(COALESCE(normalized_quantity, 0)) AS total_quantity,
                SUM(COALESCE(line_total, 0))          AS total_spend,
                COUNT(*)                               AS occurrences
            FROM line_items
            WHERE line_total IS NOT NULL
            GROUP BY LOWER(TRIM(raw_description))
            ORDER BY total_spend DESC
            LIMIT ?
        """
        return [dict(r) for r in self.db.fetchall(sql, (limit,))]

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
            unit_type=row["unit_type"],
            normalized_quantity=row["normalized_quantity"],
            material_category=row["material_category"],
            confidence=row["confidence"],
            needs_review=bool(row["needs_review"]),
        )
