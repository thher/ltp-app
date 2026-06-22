"""Dialog showing raw extracted text and OCR diagnostics for an invoice."""
from __future__ import annotations

from typing import TYPE_CHECKING

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QDialog,
    QDialogButtonBox,
    QLabel,
    QPlainTextEdit,
    QVBoxLayout,
    QFormLayout,
    QWidget,
    QFrame,
)

if TYPE_CHECKING:
    from app.database.models import Invoice


class OcrTextDialog(QDialog):
    """Shows extraction diagnostics and raw extracted text for an invoice."""

    def __init__(self, invoice: "Invoice", parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle(f"Extracted Text — Invoice #{invoice.id}")
        self.setMinimumSize(700, 500)
        self.resize(800, 600)
        self._build_ui(invoice)

    def _build_ui(self, invoice: "Invoice") -> None:
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(16, 16, 16, 16)

        # Diagnostics section
        diag_frame = QFrame()
        diag_frame.setFrameShape(QFrame.Shape.StyledPanel)
        diag_layout = QFormLayout(diag_frame)
        diag_layout.setContentsMargins(12, 8, 12, 8)
        diag_layout.setSpacing(6)

        def _val(v, fallback="—") -> str:
            return str(v) if v is not None else fallback

        diag_layout.addRow("Extraction method:", QLabel(_val(invoice.extraction_method)))
        diag_layout.addRow("OCR available:", QLabel("yes" if invoice.ocr_available else "no"))
        diag_layout.addRow("OCR language:", QLabel(_val(invoice.ocr_lang)))

        length = invoice.ocr_text_length
        if length is None and invoice.raw_text:
            length = len(invoice.raw_text)
        diag_layout.addRow("Text length (chars):", QLabel(_val(length)))

        conf = invoice.parser_confidence
        conf_str = f"{conf:.0%}" if conf is not None else "—"
        diag_layout.addRow("Parser confidence:", QLabel(conf_str))

        layout.addWidget(diag_frame)

        # Raw text section
        text_label = QLabel("Raw extracted text (first 2000 characters):")
        text_label.setStyleSheet("font-weight: bold; color: #cdd6f4;")
        layout.addWidget(text_label)

        text_edit = QPlainTextEdit()
        text_edit.setReadOnly(True)
        mono = QFont("Courier New", 9)
        mono.setStyleHint(QFont.StyleHint.Monospace)
        text_edit.setFont(mono)

        raw = invoice.raw_text or ""
        text_edit.setPlainText(raw[:2000] if raw else "(no text extracted)")
        layout.addWidget(text_edit)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
