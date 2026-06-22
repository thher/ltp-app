"""
Migration v005: Add extraction diagnostic fields to the invoices table.

These fields capture how text was extracted from each PDF, enabling the
Review Queue 'View Extracted Text' and 'Reprocess' features and making
it visible exactly why a parse failed.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

VERSION = "v005_extraction_diagnostics"

_NEW_COLUMNS = [
    ("extraction_method", "TEXT"),    # "pdf_text"|"ocr"|"fallback"|"failed"
    ("ocr_available",     "INTEGER"), # 1=yes, 0=no
    ("ocr_lang",          "TEXT"),    # e.g. "nor+eng" or "eng"
    ("ocr_text_length",   "INTEGER"), # character count of raw_text
    ("parser_confidence", "REAL"),    # ParseResult.overall_confidence (0.0-1.0)
]


def up(db: "DatabaseManager") -> None:
    for col_name, col_type in _NEW_COLUMNS:
        try:
            db.execute(
                f"ALTER TABLE invoices ADD COLUMN {col_name} {col_type}"
            )
        except Exception:
            pass  # Column already exists — safe to skip
