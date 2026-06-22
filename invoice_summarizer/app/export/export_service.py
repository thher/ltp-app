"""Data aggregation for exports — queries all repos with optional filters."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.repositories.aggregation_repo import AggregationRepository


class ExportService:
    def __init__(self, db: DatabaseManager, agg_repo: AggregationRepository) -> None:
        self._db = db
        self._agg = agg_repo

    def gather_data(
        self,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        supplier_id: Optional[int] = None,
        material_category: Optional[str] = None,
    ) -> dict:
        """Collect all export data, applying optional filters."""
        return {
            "generated_at": datetime.now(),
            "filters": {
                "date_from": str(date_from) if date_from else None,
                "date_to": str(date_to) if date_to else None,
                "supplier_id": supplier_id,
                "material_category": material_category,
            },
            "kpis":               self._kpis(date_from, date_to, supplier_id),
            "invoices":           self._invoices(date_from, date_to, supplier_id),
            "suppliers":          self._suppliers(),
            "products":           self._products(date_from, date_to, supplier_id, material_category),
            "material_categories":self._material_categories(date_from, date_to, supplier_id, material_category),
            "review_queue":       self._review_queue(),
        }

    # ── private queries ───────────────────────────────────────────────────────

    def _kpis(self, date_from, date_to, supplier_id) -> dict:
        where, params = _invoice_where(date_from, date_to, supplier_id)
        row = self._db.fetchone(
            f"""
            SELECT
                COUNT(DISTINCT i.supplier_id)     AS active_suppliers,
                COUNT(*)                           AS invoice_count,
                COALESCE(SUM(i.grand_total), 0)   AS total_spend,
                COALESCE(AVG(i.grand_total), 0)   AS avg_invoice
            FROM invoices i {where}
            """,
            tuple(params),
        )
        return dict(row) if row else {}

    def _invoices(self, date_from, date_to, supplier_id) -> list[dict]:
        where, params = _invoice_where(date_from, date_to, supplier_id)
        rows = self._db.fetchall(
            f"""
            SELECT
                i.id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                COALESCE(s.canonical_name, '—') AS supplier_name,
                i.currency,
                i.subtotal,
                i.vat_total,
                i.grand_total,
                i.status
            FROM invoices i
            LEFT JOIN suppliers s ON s.id = i.supplier_id
            {where}
            ORDER BY i.invoice_date DESC, i.id DESC
            """,
            tuple(params),
        )
        return [dict(r) for r in rows]

    def _suppliers(self) -> list[dict]:
        return self._agg.supplier_stats()

    def _products(self, date_from, date_to, supplier_id, material_category) -> list[dict]:
        where, params = _li_where(date_from, date_to, supplier_id, material_category)
        rows = self._db.fetchall(
            f"""
            SELECT
                COALESCE(s.canonical_name, '—')  AS supplier_name,
                li.raw_description,
                li.unit,
                MAX(li.material_category)         AS material_category,
                SUM(COALESCE(li.quantity, 0))    AS total_quantity,
                SUM(li.total_length)              AS total_length_m,
                SUM(COALESCE(li.line_total, 0))  AS total_spend,
                COUNT(*)                          AS occurrences,
                MAX(li.needs_review)              AS needs_review
            FROM line_items li
            JOIN   invoices   i ON li.invoice_id = i.id
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            {where}
            GROUP BY COALESCE(i.supplier_id, -1), LOWER(TRIM(li.raw_description))
            ORDER BY supplier_name, total_spend DESC
            """,
            tuple(params),
        )
        return [dict(r) for r in rows]

    def _material_categories(self, date_from, date_to, supplier_id, material_category) -> list[dict]:
        extra = ["li.material_category IS NOT NULL", "li.unit_type IS NOT NULL"]
        where, params = _li_where(date_from, date_to, supplier_id, material_category, extra=extra)
        rows = self._db.fetchall(
            f"""
            SELECT
                li.material_category,
                li.unit_type,
                SUM(COALESCE(li.normalized_quantity, 0)) AS total_quantity,
                SUM(COALESCE(li.line_total, 0))          AS total_spend,
                COUNT(*)                                  AS item_count
            FROM line_items li
            JOIN invoices i ON li.invoice_id = i.id
            {where}
            GROUP BY li.material_category, li.unit_type
            ORDER BY total_spend DESC
            """,
            tuple(params),
        )
        return [dict(r) for r in rows]

    def _review_queue(self) -> list[dict]:
        rows = self._db.fetchall(
            """
            SELECT
                rq.id,
                rq.invoice_id,
                rq.line_item_id,
                rq.issue_type,
                rq.description,
                rq.suggestion,
                rq.resolved,
                rq.resolution,
                rq.created_at,
                COALESCE(s.canonical_name, '—') AS supplier_name,
                i.invoice_number
            FROM review_queue rq
            LEFT JOIN invoices   i ON i.id  = rq.invoice_id
            LEFT JOIN suppliers  s ON s.id  = i.supplier_id
            ORDER BY rq.created_at DESC
            """
        )
        return [dict(r) for r in rows]


# ── SQL helpers ───────────────────────────────────────────────────────────────

def _invoice_where(
    date_from=None, date_to=None, supplier_id=None, alias: str = "i"
) -> tuple[str, list]:
    conds: list[str] = []
    params: list = []
    if date_from:
        conds.append(f"{alias}.invoice_date >= ?"); params.append(str(date_from))
    if date_to:
        conds.append(f"{alias}.invoice_date <= ?"); params.append(str(date_to))
    if supplier_id is not None:
        conds.append(f"{alias}.supplier_id = ?"); params.append(supplier_id)
    return (("WHERE " + " AND ".join(conds)) if conds else ""), params


def _li_where(
    date_from=None,
    date_to=None,
    supplier_id=None,
    material_category=None,
    extra: list[str] | None = None,
    alias: str = "i",
) -> tuple[str, list]:
    conds: list[str] = []
    params: list = []
    if date_from:
        conds.append(f"{alias}.invoice_date >= ?"); params.append(str(date_from))
    if date_to:
        conds.append(f"{alias}.invoice_date <= ?"); params.append(str(date_to))
    if supplier_id is not None:
        conds.append(f"{alias}.supplier_id = ?"); params.append(supplier_id)
    if material_category:
        conds.append("li.material_category = ?"); params.append(material_category)
    if extra:
        conds.extend(extra)
    return (("WHERE " + " AND ".join(conds)) if conds else ""), params
