from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import AggregatedPurchase, CategoryAggregation


class AggregationRepository:
    """
    Read/write for aggregated_purchases and category_aggregations.
    Also provides all dashboard-level and list-view queries.
    """

    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    # ── Dashboard KPIs ────────────────────────────────────────────────

    def total_suppliers(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM suppliers") or 0

    def total_invoices(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM invoices") or 0

    def total_spend(self) -> float:
        return (
            self.db.fetchscalar(
                "SELECT COALESCE(SUM(grand_total), 0) FROM invoices "
                "WHERE status = 'processed'"
            )
            or 0.0
        )

    def total_categories(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM categories") or 0

    # ── Spend by category (live, via invoices → suppliers → categories) ──

    def spend_by_category(self) -> list[dict]:
        """
        Returns per-category spend aggregated directly from the invoices table.
        This query is used by both the Dashboard and Categories screens.
        """
        rows = self.db.fetchall(
            """
            SELECT
                c.id,
                c.name,
                c.color,
                COALESCE(SUM(i.grand_total), 0.0)  AS total_gross,
                COUNT(DISTINCT i.id)               AS invoice_count,
                COUNT(DISTINCT s.id)               AS supplier_count
            FROM categories c
            LEFT JOIN suppliers s ON s.category_id = c.id
            LEFT JOIN invoices   i ON i.supplier_id = s.id
                                   AND i.status = 'processed'
            GROUP BY c.id, c.name, c.color
            ORDER BY total_gross DESC
            """
        )
        return [dict(r) for r in rows]

    # ── Supplier-level stats (for Suppliers screen table) ─────────────

    def supplier_stats(self) -> list[dict]:
        """
        Returns one row per supplier with aggregated invoice data.
        [{id, canonical_name, category_name, category_color,
          category_id, country, invoice_count, total_spend}]
        """
        rows = self.db.fetchall(
            """
            SELECT
                s.id,
                s.canonical_name,
                COALESCE(c.name,  'Uncategorized') AS category_name,
                COALESCE(c.color, '#6c7086')       AS category_color,
                s.category_id,
                COALESCE(s.country, '')            AS country,
                COUNT(DISTINCT i.id)               AS invoice_count,
                COALESCE(SUM(i.grand_total), 0.0)  AS total_spend
            FROM suppliers s
            LEFT JOIN categories c ON c.id = s.category_id
            LEFT JOIN invoices   i ON i.supplier_id = s.id
                                   AND i.status = 'processed'
            GROUP BY s.id, s.canonical_name, c.name, c.color, s.category_id, s.country
            ORDER BY s.canonical_name
            """
        )
        return [dict(r) for r in rows]

    # ── Dashboard tables ──────────────────────────────────────────────

    def top_suppliers_by_spend(self, limit: int = 10) -> list[dict]:
        rows = self.db.fetchall(
            """
            SELECT s.id AS supplier_id,
                   s.canonical_name,
                   COALESCE(SUM(i.grand_total), 0) AS total_gross,
                   COUNT(i.id)                     AS invoice_count
            FROM suppliers s
            LEFT JOIN invoices i ON i.supplier_id = s.id
                                 AND i.status = 'processed'
            GROUP BY s.id, s.canonical_name
            ORDER BY total_gross DESC
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(r) for r in rows]

    def top_suppliers_by_invoice_count(self, limit: int = 10) -> list[dict]:
        rows = self.db.fetchall(
            """
            SELECT s.id AS supplier_id,
                   s.canonical_name,
                   COUNT(i.id)                     AS invoice_count,
                   COALESCE(SUM(i.grand_total), 0) AS total_gross
            FROM suppliers s
            LEFT JOIN invoices i ON i.supplier_id = s.id
            GROUP BY s.id, s.canonical_name
            ORDER BY invoice_count DESC
            LIMIT ?
            """,
            (limit,),
        )
        return [dict(r) for r in rows]

    # ── Aggregated Purchases ──────────────────────────────────────────

    def upsert_purchase(self, purchase: AggregatedPurchase) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                INSERT INTO aggregated_purchases
                    (supplier_id, product_id, total_quantity, total_net,
                     total_vat, total_gross, invoice_count, first_seen, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(supplier_id, product_id) DO UPDATE SET
                    total_quantity = total_quantity + excluded.total_quantity,
                    total_net      = total_net + excluded.total_net,
                    total_vat      = total_vat + excluded.total_vat,
                    total_gross    = total_gross + excluded.total_gross,
                    invoice_count  = invoice_count + excluded.invoice_count,
                    first_seen     = MIN(first_seen, excluded.first_seen),
                    last_seen      = MAX(last_seen, excluded.last_seen),
                    updated_at     = CURRENT_TIMESTAMP
                """,
                (
                    purchase.supplier_id,
                    purchase.product_id,
                    purchase.total_quantity,
                    purchase.total_net,
                    purchase.total_vat,
                    purchase.total_gross,
                    purchase.invoice_count,
                    purchase.first_seen,
                    purchase.last_seen,
                ),
            )

    def find_by_supplier(self, supplier_id: int) -> list[AggregatedPurchase]:
        rows = self.db.fetchall(
            "SELECT * FROM aggregated_purchases WHERE supplier_id = ? "
            "ORDER BY total_gross DESC",
            (supplier_id,),
        )
        return [self._row_to_purchase(r) for r in rows]

    # ── Category Aggregations ─────────────────────────────────────────

    def upsert_category(self, agg: CategoryAggregation) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                INSERT INTO category_aggregations
                    (category_id, period_year, period_month, total_net,
                     total_vat, total_gross, invoice_count, supplier_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(category_id, period_year, period_month) DO UPDATE SET
                    total_net      = total_net + excluded.total_net,
                    total_vat      = total_vat + excluded.total_vat,
                    total_gross    = total_gross + excluded.total_gross,
                    invoice_count  = invoice_count + excluded.invoice_count,
                    supplier_count = excluded.supplier_count,
                    updated_at     = CURRENT_TIMESTAMP
                """,
                (
                    agg.category_id,
                    agg.period_year,
                    agg.period_month,
                    agg.total_net,
                    agg.total_vat,
                    agg.total_gross,
                    agg.invoice_count,
                    agg.supplier_count,
                ),
            )

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _row_to_purchase(row) -> AggregatedPurchase:
        return AggregatedPurchase(
            id=row["id"],
            supplier_id=row["supplier_id"],
            product_id=row["product_id"],
            total_quantity=row["total_quantity"],
            total_net=row["total_net"],
            total_vat=row["total_vat"],
            total_gross=row["total_gross"],
            invoice_count=row["invoice_count"],
            first_seen=row["first_seen"],
            last_seen=row["last_seen"],
            updated_at=row["updated_at"],
        )
