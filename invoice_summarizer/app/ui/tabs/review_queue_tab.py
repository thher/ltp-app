"""Review Queue tab — flagged invoices requiring manual resolution."""
from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QHBoxLayout,
    QHeaderView,
    QInputDialog,
    QLabel,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.models import ReviewQueueItem
from app.database.repositories.invoice_repo import InvoiceRepository
from app.database.repositories.review_queue_repo import ReviewQueueRepository

if TYPE_CHECKING:
    from app.processing.pipeline import ProcessingPipeline


_ISSUE_LABELS = {
    "low_confidence_supplier": "Unmatched Supplier",
    "unmatched_product":       "Unmatched Product",
    "duplicate_invoice":       "Possible Duplicate",
    "parse_error":             "Parse Error",
    "missing_field":           "Missing Field",
}

_ISSUE_COLORS = {
    "low_confidence_supplier": "#f9e2af",
    "missing_field":           "#fab387",
    "parse_error":             "#f38ba8",
    "duplicate_invoice":       "#cba6f7",
    "unmatched_product":       "#89b4fa",
}


class ReviewQueueTab(QWidget):
    """Shows unresolved review items; lets the user mark them resolved."""

    def __init__(
        self,
        review_repo: ReviewQueueRepository,
        invoice_repo: InvoiceRepository,
        pipeline: Optional["ProcessingPipeline"] = None,
    ) -> None:
        super().__init__()
        self._review_repo = review_repo
        self._inv_repo = invoice_repo
        self._pipeline = pipeline
        self._items: list[ReviewQueueItem] = []
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

        title = QLabel("Review Queue")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4; background: transparent;")
        h_layout.addWidget(title)
        h_layout.addStretch()

        self._badge = QLabel()
        self._badge.setStyleSheet(
            "background: #f38ba8; color: #1e1e2e; border-radius: 10px; "
            "padding: 2px 8px; font-size: 11px; font-weight: bold;"
        )
        self._badge.setVisible(False)
        h_layout.addWidget(self._badge)

        root.addWidget(header)

        # Body
        body = QWidget()
        b_layout = QVBoxLayout(body)
        b_layout.setContentsMargins(28, 20, 28, 20)
        b_layout.setSpacing(12)

        # Action row
        action_row = QHBoxLayout()
        self._resolve_btn = QPushButton("Mark Resolved")
        self._resolve_btn.setObjectName("primary")
        self._resolve_btn.setEnabled(False)
        self._resolve_btn.clicked.connect(self._on_resolve)
        action_row.addWidget(self._resolve_btn)

        self._view_text_btn = QPushButton("View Extracted Text")
        self._view_text_btn.setEnabled(False)
        self._view_text_btn.clicked.connect(self._on_view_text)
        action_row.addWidget(self._view_text_btn)

        self._reprocess_btn = QPushButton("Reprocess")
        self._reprocess_btn.setEnabled(False)
        self._reprocess_btn.clicked.connect(self._on_reprocess)
        action_row.addWidget(self._reprocess_btn)

        action_row.addStretch()
        b_layout.addLayout(action_row)

        self._table = QTableWidget(0, 5)
        self._table.setHorizontalHeaderLabels(
            ["Invoice", "Issue Type", "Description", "Suggestion", "Status"]
        )
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setShowGrid(False)
        hdr = self._table.horizontalHeader()
        hdr.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        hdr.setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        hdr.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self._table.selectionModel().selectionChanged.connect(self._on_selection)
        b_layout.addWidget(self._table)

        self._count_lbl = QLabel()
        self._count_lbl.setStyleSheet("color: #6c7086; font-size: 11px;")
        b_layout.addWidget(self._count_lbl)

        root.addWidget(body)

    # ── Data ───────────────────────────────────────────────────────────

    def refresh(self) -> None:
        items = self._review_repo.find_all()
        self._items = items
        self._table.setRowCount(0)

        for item in items:
            r = self._table.rowCount()
            self._table.insertRow(r)
            self._table.setRowHeight(r, 38)

            # Invoice identifier
            inv_label = f"#{item.invoice_id}" if item.invoice_id else "—"
            self._table.setItem(r, 0, QTableWidgetItem(inv_label))

            # Issue type badge
            label = _ISSUE_LABELS.get(item.issue_type, item.issue_type)
            issue_item = QTableWidgetItem(label)
            color = _ISSUE_COLORS.get(item.issue_type, "#cdd6f4")
            issue_item.setForeground(QColor(color))
            self._table.setItem(r, 1, issue_item)

            self._table.setItem(r, 2, QTableWidgetItem(item.description or ""))
            self._table.setItem(r, 3, QTableWidgetItem(item.suggestion or ""))

            status_str = "Resolved" if item.resolved else "Open"
            status_item = QTableWidgetItem(status_str)
            status_item.setForeground(
                QColor("#a6e3a1") if item.resolved else QColor("#f38ba8")
            )
            status_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._table.setItem(r, 4, status_item)

        unresolved = self._review_repo.count_unresolved()
        n = len(items)
        self._count_lbl.setText(
            f"{n} item{'s' if n != 1 else ''} · {unresolved} open"
        )

        if unresolved > 0:
            self._badge.setText(str(unresolved))
            self._badge.setVisible(True)
        else:
            self._badge.setVisible(False)

    # ── Actions ────────────────────────────────────────────────────────

    def _selected_item(self) -> Optional[ReviewQueueItem]:
        selected = self._table.selectionModel().selectedRows()
        if not selected:
            return None
        row = selected[0].row()
        if row < len(self._items):
            return self._items[row]
        return None

    def _on_selection(self) -> None:
        item = self._selected_item()
        can_resolve = False
        has_invoice = False
        has_pipeline = self._pipeline is not None

        if item is not None:
            status_cell = self._table.item(
                self._table.selectionModel().selectedRows()[0].row(), 4
            )
            can_resolve = status_cell is not None and status_cell.text() == "Open"
            has_invoice = item.invoice_id is not None

        self._resolve_btn.setEnabled(can_resolve)
        self._view_text_btn.setEnabled(has_invoice)
        self._reprocess_btn.setEnabled(has_invoice and has_pipeline)

    def _on_resolve(self) -> None:
        item = self._selected_item()
        if item is None:
            return

        resolution, ok = QInputDialog.getText(
            self,
            "Resolve Item",
            "Resolution note (optional):",
        )
        if ok:
            self._review_repo.resolve(item.id, resolution or "Manually resolved")
            self.refresh()

    def _on_view_text(self) -> None:
        item = self._selected_item()
        if item is None or item.invoice_id is None:
            return

        invoice = self._inv_repo.find_by_id(item.invoice_id)
        if invoice is None:
            QMessageBox.warning(self, "Not Found", f"Invoice #{item.invoice_id} not found.")
            return

        from app.ui.dialogs.ocr_text_dialog import OcrTextDialog
        dlg = OcrTextDialog(invoice, parent=self)
        dlg.exec()

    def _on_reprocess(self) -> None:
        if self._pipeline is None:
            return
        item = self._selected_item()
        if item is None or item.invoice_id is None:
            return

        invoice = self._inv_repo.find_by_id(item.invoice_id)
        if invoice is None:
            QMessageBox.warning(self, "Not Found", f"Invoice #{item.invoice_id} not found.")
            return

        self._reprocess_btn.setEnabled(False)
        self._reprocess_btn.setText("Reprocessing...")

        try:
            result = self._pipeline.reprocess_invoice(invoice)
            if result.status == "processed":
                QMessageBox.information(
                    self,
                    "Reprocess Complete",
                    f"Invoice #{invoice.id} was reprocessed successfully.\n"
                    f"Imported {result.imported} invoice(s).",
                )
            else:
                QMessageBox.warning(
                    self,
                    "Reprocess Failed",
                    f"Invoice #{invoice.id} reprocessing failed:\n{result.error or 'Unknown error'}",
                )
        except Exception as exc:
            QMessageBox.critical(self, "Error", f"Reprocess error: {exc}")
        finally:
            self._reprocess_btn.setText("Reprocess")
            self.refresh()
