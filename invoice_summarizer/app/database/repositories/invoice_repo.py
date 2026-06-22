from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import Invoice


class InvoiceRepository:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def save(self, invoice: Invoice) -> Invoice:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT INTO invoices
                    (supplier_id, invoice_number, invoice_date, due_date,
                     currency, subtotal, vat_total, grand_total,
                     original_path, copy_path, file_hash, source_pdf_hash,
                     kid_number, status, error_message, raw_text,
                     extraction_method, ocr_available, ocr_lang,
                     ocr_text_length, parser_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?)
                """,
                (
                    invoice.supplier_id,
                    invoice.invoice_number,
                    invoice.invoice_date,
                    invoice.due_date,
                    invoice.currency,
                    invoice.subtotal,
                    invoice.vat_total,
                    invoice.grand_total,
                    invoice.original_path,
                    invoice.copy_path,
                    invoice.file_hash,
                    invoice.source_pdf_hash,
                    invoice.kid_number,
                    invoice.status,
                    invoice.error_message,
                    invoice.raw_text,
                    invoice.extraction_method,
                    int(invoice.ocr_available) if invoice.ocr_available is not None else None,
                    invoice.ocr_lang,
                    invoice.ocr_text_length,
                    invoice.parser_confidence,
                ),
            )
            invoice.id = cursor.lastrowid
        return invoice

    def find_by_id(self, invoice_id: int) -> Optional[Invoice]:
        row = self.db.fetchone(
            "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
        )
        return self._row_to_model(row) if row else None

    def find_by_hash(self, file_hash: str) -> Optional[Invoice]:
        row = self.db.fetchone(
            "SELECT * FROM invoices WHERE file_hash = ?", (file_hash,)
        )
        return self._row_to_model(row) if row else None

    def find_by_source_hash(self, source_pdf_hash: str) -> Optional[Invoice]:
        """Find any invoice imported from a PDF with the given SHA256 hash.

        Works for both single-invoice PDFs (where source_pdf_hash == file_hash)
        and multi-invoice PDFs (where multiple invoices share source_pdf_hash).
        """
        row = self.db.fetchone(
            """
            SELECT * FROM invoices
            WHERE source_pdf_hash = ? OR file_hash = ?
            LIMIT 1
            """,
            (source_pdf_hash, source_pdf_hash),
        )
        return self._row_to_model(row) if row else None

    def find_by_supplier(self, supplier_id: int) -> list[Invoice]:
        rows = self.db.fetchall(
            "SELECT * FROM invoices WHERE supplier_id = ? ORDER BY invoice_date DESC",
            (supplier_id,),
        )
        return [self._row_to_model(r) for r in rows]

    def find_by_status(self, status: str) -> list[Invoice]:
        rows = self.db.fetchall(
            "SELECT * FROM invoices WHERE status = ? ORDER BY imported_at DESC",
            (status,),
        )
        return [self._row_to_model(r) for r in rows]

    def find_all(self) -> list[Invoice]:
        rows = self.db.fetchall(
            "SELECT * FROM invoices ORDER BY imported_at DESC"
        )
        return [self._row_to_model(r) for r in rows]

    def update_status(self, invoice_id: int, status: str, error: Optional[str] = None) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                UPDATE invoices
                SET status = ?, error_message = ?,
                    processed_at = CASE WHEN ? = 'processed' THEN CURRENT_TIMESTAMP ELSE processed_at END
                WHERE id = ?
                """,
                (status, error, status, invoice_id),
            )

    def update(self, invoice: Invoice) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                UPDATE invoices
                SET supplier_id = ?, invoice_number = ?, invoice_date = ?,
                    due_date = ?, currency = ?, subtotal = ?, vat_total = ?,
                    grand_total = ?, kid_number = ?, status = ?,
                    error_message = ?, raw_text = ?,
                    extraction_method = ?, ocr_available = ?, ocr_lang = ?,
                    ocr_text_length = ?, parser_confidence = ?
                WHERE id = ?
                """,
                (
                    invoice.supplier_id,
                    invoice.invoice_number,
                    invoice.invoice_date,
                    invoice.due_date,
                    invoice.currency,
                    invoice.subtotal,
                    invoice.vat_total,
                    invoice.grand_total,
                    invoice.kid_number,
                    invoice.status,
                    invoice.error_message,
                    invoice.raw_text,
                    invoice.extraction_method,
                    int(invoice.ocr_available) if invoice.ocr_available is not None else None,
                    invoice.ocr_lang,
                    invoice.ocr_text_length,
                    invoice.parser_confidence,
                    invoice.id,
                ),
            )

    def find_all_with_details(self) -> list[dict]:
        """Return invoices joined with supplier name for the Documents screen."""
        return self.db.fetchall(
            """
            SELECT
                i.id,
                i.original_path,
                i.invoice_number,
                i.invoice_date,
                i.grand_total,
                i.currency,
                i.status,
                i.imported_at,
                COALESCE(s.canonical_name, '—') AS supplier_name
            FROM invoices i
            LEFT JOIN suppliers s ON s.id = i.supplier_id
            ORDER BY i.imported_at DESC
            """
        )

    def count(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM invoices") or 0

    def total_spend(self) -> float:
        return self.db.fetchscalar(
            "SELECT COALESCE(SUM(grand_total), 0) FROM invoices WHERE status = 'processed'"
        ) or 0.0

    @staticmethod
    def _row_to_model(row) -> Invoice:
        def _col(key, default=None):
            try:
                return row[key]
            except IndexError:
                return default

        ocr_avail_raw = _col("ocr_available")
        return Invoice(
            id=row["id"],
            supplier_id=row["supplier_id"],
            invoice_number=row["invoice_number"],
            invoice_date=row["invoice_date"],
            due_date=row["due_date"],
            currency=row["currency"],
            subtotal=row["subtotal"],
            vat_total=row["vat_total"],
            grand_total=row["grand_total"],
            original_path=row["original_path"],
            copy_path=row["copy_path"],
            file_hash=row["file_hash"],
            source_pdf_hash=row["source_pdf_hash"],
            kid_number=row["kid_number"],
            status=row["status"],
            error_message=row["error_message"],
            raw_text=row["raw_text"],
            imported_at=row["imported_at"],
            processed_at=row["processed_at"],
            extraction_method=_col("extraction_method"),
            ocr_available=bool(ocr_avail_raw) if ocr_avail_raw is not None else None,
            ocr_lang=_col("ocr_lang"),
            ocr_text_length=_col("ocr_text_length"),
            parser_confidence=_col("parser_confidence"),
        )
