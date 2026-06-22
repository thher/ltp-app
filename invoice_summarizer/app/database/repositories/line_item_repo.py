from __future__ import annotations

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
                     confidence, needs_review)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            confidence=row["confidence"],
            needs_review=bool(row["needs_review"]),
        )
