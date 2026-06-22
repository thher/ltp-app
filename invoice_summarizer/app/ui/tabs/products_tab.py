"""Products tab — aggregated spend by supplier + product/service description."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.repositories.line_item_repo import LineItemRepository


class ProductsTab(QWidget):
    """Aggregated line-item spend across all invoices, grouped by supplier + description."""

    def __init__(self, line_item_repo: LineItemRepository) -> None:
        super().__init__()
        self._li_repo = line_item_repo
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

        title = QLabel("Products & Services")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4; background: transparent;")
        h_layout.addWidget(title)
        h_layout.addStretch()

        refresh_btn = QPushButton("↻ Refresh")
        refresh_btn.setObjectName("secondary")
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        refresh_btn.clicked.connect(self.refresh)
        h_layout.addWidget(refresh_btn)
        root.addWidget(header)

        # Body
        body = QWidget()
        b_layout = QVBoxLayout(body)
        b_layout.setContentsMargins(28, 20, 28, 20)
        b_layout.setSpacing(12)

        subtitle = QLabel(
            "All extracted line items aggregated by supplier and description. "
            "Items marked for review have uncertain OCR."
        )
        subtitle.setStyleSheet("color: #a6adc8; font-size: 12px;")
        subtitle.setWordWrap(True)
        b_layout.addWidget(subtitle)

        self._table = QTableWidget(0, 7)
        self._table.setHorizontalHeaderLabels(
            ["Supplier", "Description", "Unit", "Total Qty", "Length (m)", "Total Spend", "Count"]
        )
        self._table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._table.setAlternatingRowColors(True)
        self._table.verticalHeader().setVisible(False)
        self._table.setShowGrid(False)
        hdr = self._table.horizontalHeader()
        hdr.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        hdr.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(5, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(6, QHeaderView.ResizeMode.ResizeToContents)
        b_layout.addWidget(self._table)

        self._count_lbl = QLabel()
        self._count_lbl.setStyleSheet("color: #6c7086; font-size: 11px;")
        b_layout.addWidget(self._count_lbl)

        root.addWidget(body)

    # ── Data ───────────────────────────────────────────────────────────

    def refresh(self) -> None:
        rows = self._li_repo.find_aggregated()
        self._table.setRowCount(0)

        for row in rows:
            r = self._table.rowCount()
            self._table.insertRow(r)
            self._table.setRowHeight(r, 34)

            needs_review = bool(row.get("needs_review", 0))

            supplier_item = QTableWidgetItem(row.get("supplier_name") or "—")
            if needs_review:
                supplier_item.setForeground(QColor("#f9e2af"))
            self._table.setItem(r, 0, supplier_item)

            desc = row.get("raw_description") or "—"
            desc_item = QTableWidgetItem(desc)
            if needs_review:
                desc_item.setForeground(QColor("#f9e2af"))
                desc_item.setToolTip("OCR confidence is low — description may be incomplete")
            self._table.setItem(r, 1, desc_item)

            self._table.setItem(r, 2, QTableWidgetItem(row.get("unit") or "—"))

            qty = row.get("total_quantity")
            qty_str = f"{qty:,.2f}".rstrip("0").rstrip(".") if qty else "—"
            qty_item = QTableWidgetItem(qty_str)
            qty_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(r, 3, qty_item)

            length_m = row.get("total_length_m")
            length_str = f"{length_m:,.1f}" if length_m else "—"
            length_item = QTableWidgetItem(length_str)
            length_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(r, 4, length_item)

            spend = row.get("total_spend")
            spend_str = f"{spend:,.2f}" if spend else "—"
            spend_item = QTableWidgetItem(spend_str)
            spend_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(r, 5, spend_item)

            cnt_item = QTableWidgetItem(str(row.get("occurrences", 0)))
            cnt_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._table.setItem(r, 6, cnt_item)

        n = len(rows)
        self._count_lbl.setText(
            f"{n} product/service entr{'ies' if n != 1 else 'y'}"
        )
