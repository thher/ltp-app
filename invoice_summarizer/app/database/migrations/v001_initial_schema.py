"""
Migration v001: Initial schema.
Creates all core tables including categories, suppliers, invoices,
products, line items, aggregation tables, and review queue.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

VERSION = "v001_initial_schema"

_TABLES = [
    # ── Categories ────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS categories (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL UNIQUE,
        description  TEXT,
        color        TEXT,
        icon         TEXT,
        parent_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        ai_keywords  TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """,

    # ── Suppliers ─────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS suppliers (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_name TEXT    NOT NULL UNIQUE,
        normalized_key TEXT    NOT NULL UNIQUE,
        category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        country        TEXT,
        vat_number     TEXT,
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS supplier_aliases (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        alias       TEXT    NOT NULL,
        source      TEXT    NOT NULL DEFAULT 'detected',
        confidence  REAL    NOT NULL DEFAULT 1.0,
        UNIQUE(supplier_id, alias)
    )
    """,

    # ── Invoices ──────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS invoices (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        invoice_number TEXT,
        invoice_date   DATE,
        due_date       DATE,
        currency       TEXT    DEFAULT 'SEK',
        subtotal       REAL,
        vat_total      REAL,
        grand_total    REAL,
        original_path  TEXT    NOT NULL,
        copy_path      TEXT    NOT NULL UNIQUE,
        file_hash      TEXT    NOT NULL UNIQUE,
        status         TEXT    NOT NULL DEFAULT 'pending',
        error_message  TEXT,
        raw_text       TEXT,
        imported_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at   DATETIME
    )
    """,

    # ── Products ──────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS products (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_name TEXT    NOT NULL,
        normalized_key TEXT    NOT NULL,
        category       TEXT,
        unit           TEXT,
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS product_aliases (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        alias      TEXT    NOT NULL,
        source     TEXT    NOT NULL DEFAULT 'detected',
        UNIQUE(product_id, alias)
    )
    """,

    # ── Line Items ────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS line_items (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
        raw_description TEXT    NOT NULL,
        quantity        REAL,
        unit            TEXT,
        unit_price      REAL,
        line_total      REAL,
        vat_rate        REAL,
        vat_amount      REAL,
        confidence      REAL    NOT NULL DEFAULT 1.0,
        needs_review    INTEGER NOT NULL DEFAULT 0
    )
    """,

    # ── Aggregated Purchases (supplier × product) ─────────────────────
    """
    CREATE TABLE IF NOT EXISTS aggregated_purchases (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id    INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        total_quantity REAL    NOT NULL DEFAULT 0,
        total_net      REAL    NOT NULL DEFAULT 0,
        total_vat      REAL    NOT NULL DEFAULT 0,
        total_gross    REAL    NOT NULL DEFAULT 0,
        invoice_count  INTEGER NOT NULL DEFAULT 0,
        first_seen     DATE,
        last_seen      DATE,
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(supplier_id, product_id)
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS aggregation_sources (
        aggregation_id INTEGER NOT NULL REFERENCES aggregated_purchases(id) ON DELETE CASCADE,
        line_item_id   INTEGER NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
        PRIMARY KEY (aggregation_id, line_item_id)
    )
    """,

    # ── Category Aggregations ─────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS category_aggregations (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        period_year    INTEGER NOT NULL,
        period_month   INTEGER,
        total_net      REAL    NOT NULL DEFAULT 0,
        total_vat      REAL    NOT NULL DEFAULT 0,
        total_gross    REAL    NOT NULL DEFAULT 0,
        invoice_count  INTEGER NOT NULL DEFAULT 0,
        supplier_count INTEGER NOT NULL DEFAULT 0,
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, period_year, period_month)
    )
    """,

    # ── Review Queue ──────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS review_queue (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id   INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        line_item_id INTEGER REFERENCES line_items(id) ON DELETE CASCADE,
        issue_type   TEXT    NOT NULL,
        description  TEXT,
        suggestion   TEXT,
        resolved     INTEGER NOT NULL DEFAULT 0,
        resolution   TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at  DATETIME
    )
    """,
]

_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_suppliers_category   ON suppliers(category_id)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_supplier    ON invoices(supplier_id)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_date        ON invoices(invoice_date)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status)",
    "CREATE INDEX IF NOT EXISTS idx_line_items_invoice   ON line_items(invoice_id)",
    "CREATE INDEX IF NOT EXISTS idx_line_items_product   ON line_items(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_agg_supplier         ON aggregated_purchases(supplier_id)",
    "CREATE INDEX IF NOT EXISTS idx_agg_product          ON aggregated_purchases(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_cat_agg_category     ON category_aggregations(category_id)",
    "CREATE INDEX IF NOT EXISTS idx_review_resolved      ON review_queue(resolved)",
]


def up(db: "DatabaseManager") -> None:
    for ddl in _TABLES + _INDEXES:
        db.execute(ddl)
