"""Documents tab — invoice list with PDF import (drag-and-drop + file dialog)."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtGui import QColor, QDragEnterEvent, QDropEvent, QFont
from PySide6.QtWidgets import (
    QFileDialog,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QMessageBox,
    QProgressDialog,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.repositories.invoice_repo import InvoiceRepository
from app.processing.pipeline import ProcessingPipeline, PipelineResult

log = logging.getLogger(__name__)


class _ImportWorker(QThread):
    """Background thread that runs the pipeline for each PDF."""

    progress = Signal(str)          # label update for the progress dialog
    finished = Signal(list)         # list[PipelineResult] — all results

    def __init__(self, pipeline: ProcessingPipeline, pdf_paths: list[Path]) -> None:
        super().__init__()
        self._pipeline  = pipeline
        self._pdf_paths = pdf_paths

    def run(self) -> None:
        results: list[PipelineResult] = []
        for i, pdf_path in enumerate(self._pdf_paths, start=1):
            self.progress.emit(
                f"Processing {i}/{len(self._pdf_paths)}: {pdf_path.name}"
            )
            log.info("[Documents] import_pdf %d/%d: %s",
                     i, len(self._pdf_paths), pdf_path.name)
            result = self._pipeline.run(pdf_path)
            results.append(result)
            log.info("[Documents] import_pdf result: %s  status=%s  error=%s",
                     pdf_path.name, result.status, result.error or "(none)")
        self.finished.emit(results)


_STATUS_COLORS = {
    "processed": "#a6e3a1",
    "review":    "#f9e2af",
    "pending":   "#89b4fa",
    "error":     "#f38ba8",
}


class DocumentsTab(QWidget):
    """Displays all imported invoices; lets the user import new PDFs."""

    import_completed = Signal()

    def __init__(
        self,
        pipeline: ProcessingPipeline,
        invoice_repo: InvoiceRepository,
    ) -> None:
        super().__init__()
        self._pipeline = pipeline
        self._inv_repo = invoice_repo
        self.setAcceptDrops(True)
        self._build_ui()
        self.refresh()

    # ── Build ──────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Header bar
        header = QWidget()
        header.setFixedHeight(56)
        header.setStyleSheet("background: #181825; border-bottom: 1px solid #313244;")
        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(28, 0, 28, 0)
        h_layout.setSpacing(12)

        title = QLabel("Documents")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4; background: transparent;")
        h_layout.addWidget(title)
        h_layout.addStretch()

        import_btn = QPushButton("+ Import PDF(s)")
        import_btn.setObjectName("primary")
        import_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        import_btn.clicked.connect(self._on_import_dialog)
        h_layout.addWidget(import_btn)
        root.addWidget(header)

        # Drop hint bar
        self._drop_hint = QLabel("  Drop PDF files here to import  ")
        self._drop_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._drop_hint.setFixedHeight(36)
        self._drop_hint.setStyleSheet(
            "background: #1e1e2e; color: #6c7086; font-size: 12px; "
            "border-bottom: 1px solid #313244;"
        )
        root.addWidget(self._drop_hint)

        # Body
        body = QWidget()
        b_layout = QVBoxLayout(body)
        b_layout.setContentsMargins(28, 20, 28, 20)
        b_layout.setSpacing(12)

        self._table = QTableWidget(0, 6)
        self._table.setHorizontalHeaderLabels(
            ["Filename", "Supplier", "Invoice #", "Date", "Total", "Status"]
        )
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setShowGrid(False)
        hdr = self._table.horizontalHeader()
        hdr.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)
        b_layout.addWidget(self._table)

        self._count_lbl = QLabel()
        self._count_lbl.setStyleSheet("color: #6c7086; font-size: 11px;")
        b_layout.addWidget(self._count_lbl)

        root.addWidget(body)

    # ── Data ───────────────────────────────────────────────────────────

    def refresh(self) -> None:
        rows = self._inv_repo.find_all_with_details()
        self._table.setRowCount(0)
        for row in rows:
            r = self._table.rowCount()
            self._table.insertRow(r)
            self._table.setRowHeight(r, 38)

            # Filename (basename of original path)
            path = row["original_path"] or ""
            name = Path(path).name if path else "—"
            self._table.setItem(r, 0, QTableWidgetItem(name))

            self._table.setItem(r, 1, QTableWidgetItem(row["supplier_name"] or "—"))
            self._table.setItem(r, 2, QTableWidgetItem(row["invoice_number"] or "—"))

            date_str = str(row["invoice_date"]) if row["invoice_date"] else "—"
            self._table.setItem(r, 3, QTableWidgetItem(date_str))

            total = row["grand_total"]
            total_str = f"{total:,.0f}" if total is not None else "—"
            total_item = QTableWidgetItem(total_str)
            total_item.setTextAlignment(
                Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
            )
            self._table.setItem(r, 4, total_item)

            status = (row["status"] or "pending").lower()
            status_item = QTableWidgetItem(status)
            status_item.setForeground(QColor(_STATUS_COLORS.get(status, "#cdd6f4")))
            status_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._table.setItem(r, 5, status_item)

        n = len(rows)
        self._count_lbl.setText(f"{n} invoice{'s' if n != 1 else ''}")

    # ── Import ─────────────────────────────────────────────────────────

    def _on_import_dialog(self) -> None:
        paths, _ = QFileDialog.getOpenFileNames(
            self,
            "Select PDF Invoice(s)",
            "",
            "PDF Files (*.pdf);;All Files (*)",
        )
        if paths:
            self._run_import([Path(p) for p in paths])

    def _run_import(self, pdf_paths: list[Path]) -> None:
        if not pdf_paths:
            return

        log.info("[Documents] starting import of %d file(s)", len(pdf_paths))

        # Progress dialog — blocks user interaction but keeps UI responsive
        self._progress = QProgressDialog(
            f"Importing {len(pdf_paths)} PDF(s)…",
            None,               # no cancel button
            0, 0,               # indeterminate (spinner)
            self,
        )
        self._progress.setWindowTitle("Importing…")
        self._progress.setWindowModality(Qt.WindowModality.WindowModal)
        self._progress.setMinimumDuration(0)
        self._progress.setValue(0)
        self._progress.show()

        # Keep a reference so the worker is not garbage-collected
        self._worker = _ImportWorker(self._pipeline, pdf_paths)
        self._worker.progress.connect(self._progress.setLabelText)
        self._worker.finished.connect(self._on_import_finished)
        self._worker.start()

    def _on_import_finished(self, file_results: list[PipelineResult]) -> None:
        self._progress.close()

        # Expand multi-invoice PDFs: use per-invoice sub-results when present
        invoice_results: list[PipelineResult] = []
        for fr in file_results:
            if fr.all_results:
                invoice_results.extend(fr.all_results)
            else:
                invoice_results.append(fr)

        ok         = sum(1 for r in invoice_results if r.ok)
        duplicates = sum(1 for r in file_results    if r.is_duplicate)
        errors     = sum(1 for r in invoice_results if r.status == "error")
        review     = sum(1 for r in invoice_results if r.ok and r.review_items)

        log.info("[Documents] import complete: ok=%d  duplicates=%d  errors=%d  review=%d",
                 ok, duplicates, errors, review)

        parts: list[str] = []
        if ok:
            parts.append(f"{ok} imported")
        if duplicates:
            parts.append(f"{duplicates} duplicate(s) skipped")
        if errors:
            parts.append(f"{errors} error(s)")
        if review:
            parts.append(f"{review} need review")

        msg = ", ".join(parts) if parts else "No files processed"

        if errors:
            err_details = "\n".join(
                f"• {r.original_path.name}:\n  {r.error}"
                for r in invoice_results
                if r.status == "error"
            )
            log.error("[Documents] import errors:\n%s", err_details)
            QMessageBox.warning(self, "Import — feil", f"{msg}\n\n{err_details}")
        else:
            QMessageBox.information(self, "Import fullført", msg)

        self.refresh()
        self.import_completed.emit()

    # ── Drag-and-drop ──────────────────────────────────────────────────

    def dragEnterEvent(self, event: QDragEnterEvent) -> None:
        if event.mimeData().hasUrls():
            pdfs = [
                u.toLocalFile() for u in event.mimeData().urls()
                if u.toLocalFile().lower().endswith(".pdf")
            ]
            if pdfs:
                event.acceptProposedAction()
                self._drop_hint.setStyleSheet(
                    "background: #313244; color: #89b4fa; font-size: 12px; "
                    "border-bottom: 1px solid #89b4fa;"
                )
                return
        event.ignore()

    def dragLeaveEvent(self, _event) -> None:
        self._reset_drop_hint()

    def dropEvent(self, event: QDropEvent) -> None:
        self._reset_drop_hint()
        pdfs = [
            Path(u.toLocalFile())
            for u in event.mimeData().urls()
            if u.toLocalFile().lower().endswith(".pdf")
        ]
        if pdfs:
            event.acceptProposedAction()
            self._run_import(pdfs)

    def _reset_drop_hint(self) -> None:
        self._drop_hint.setStyleSheet(
            "background: #1e1e2e; color: #6c7086; font-size: 12px; "
            "border-bottom: 1px solid #313244;"
        )
