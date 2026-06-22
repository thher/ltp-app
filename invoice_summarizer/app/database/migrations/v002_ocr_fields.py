"""Migration v002: Add OCR-related fields to the invoices table.

- kid_number      TEXT  — Norwegian KID payment reference
- source_pdf_hash TEXT  — SHA256 of the source PDF file; shared by all
                          invoices extracted from a single multi-invoice PDF.
                          Allows file-level duplicate detection independent of
                          the per-invoice file_hash.

The copy_path UNIQUE constraint is also dropped here (via table recreation)
so that multiple invoices from the same physical PDF can share a copy path.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

VERSION = "v002_ocr_fields"


def up(db: "DatabaseManager") -> None:
    # Recreate the invoices table without UNIQUE on copy_path and with new columns.
    # SQLite does not support ALTER TABLE DROP CONSTRAINT, so we use the
    # rename-create-copy-drop pattern.
    db.execute("""
        CREATE TABLE invoices_v2 (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
            invoice_number  TEXT,
            invoice_date    DATE,
            due_date        DATE,
            currency        TEXT    NOT NULL DEFAULT 'SEK',
            subtotal        REAL,
            vat_total       REAL,
            grand_total     REAL,
            original_path   TEXT    NOT NULL,
            copy_path       TEXT    NOT NULL,
            file_hash       TEXT    NOT NULL UNIQUE,
            source_pdf_hash TEXT,
            kid_number      TEXT,
            status          TEXT    NOT NULL DEFAULT 'pending',
            error_message   TEXT,
            raw_text        TEXT,
            imported_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at    DATETIME
        )
    """)

    db.execute("""
        INSERT INTO invoices_v2
            (id, supplier_id, invoice_number, invoice_date, due_date,
             currency, subtotal, vat_total, grand_total,
             original_path, copy_path, file_hash, source_pdf_hash, kid_number,
             status, error_message, raw_text, imported_at, processed_at)
        SELECT
            id, supplier_id, invoice_number, invoice_date, due_date,
            currency, subtotal, vat_total, grand_total,
            original_path, copy_path, file_hash,
            file_hash AS source_pdf_hash,   -- backfill: single-invoice PDFs
            NULL      AS kid_number,
            status, error_message, raw_text, imported_at, processed_at
        FROM invoices
    """)

    db.execute("DROP TABLE invoices")
    db.execute("ALTER TABLE invoices_v2 RENAME TO invoices")

    # Recreate indexes (dropped when the original table was dropped)
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_invoices_supplier    ON invoices(supplier_id)"
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_invoices_date        ON invoices(invoice_date)"
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status)"
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_invoices_source_hash ON invoices(source_pdf_hash)"
    )
