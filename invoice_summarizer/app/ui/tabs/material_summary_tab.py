"""Material Summary tab — Phase 3.2 Material Intelligence.

Shows:
  • Material Summary cards — quantity + spend per (category, unit_type)
  • Spend by Material Category
  • Top 50 Products by Quantity
  • Top 50 Products by Spend
"""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPushButton,
    QScrollArea,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.repositories.line_item_repo import LineItemRepository

# Category → accent colour (Catppuccin-compatible)
_CATEGORY_COLOURS: dict[str, str] = {
    "Timber":        "#fab387",
    "Decking":       "#a6e3a1",
    "Insulation":    "#f9e2af",
    "Drywall":       "#cba6f7",
    "Doors":         "#89b4fa",
    "Windows":       "#74c7ec",
    "Trim/Mouldings":"#b4befe",
    "Fasteners":     "#f38ba8",
    "Paint":         "#eba0ac",
    "Concrete":      "#a6adc8",
    "Roofing":       "#94e2d5",
    "Hardware":      "#89dceb",
    "Transport":     "#45475a",
    "Other":         "#6c7086",
}

_UNIT_LABELS: dict[str, str] = {
    "pcs":     "pcs",
    "m":       "m",
    "m²":      "m²",
    "m³":      "m³",
    "kg":      "kg",
    "ton":     "ton",
    "litre":   "L",
    "pack":    "pk",
    "pallet":  "pall",
    "unknown": "",
}


def _fmt_qty(value: float, unit: str) -> str:
    label = _UNIT_LABELS.get(unit, unit)
    if value >= 1_000:
        s = f"{value:,.0f}"
    elif value == int(value):
        s = str(int(value))
    else:
        s = f"{value:,.1f}"
    return f"{s} {label}".strip()


class _SectionLabel(QLabel):
    def __init__(self, text: str) -> None:
        super().__init__(text)
        font = QFont()
        font.setPointSize(11)
        font.setBold(True)
        self.setFont(font)
        self.setStyleSheet(
            "color: #a6adc8; letter-spacing: 0.5px; "
            "margin-top: 10px; background: transparent;"
        )


class _ReportTable(QTableWidget):
    def __init__(self, headers: list[str]) -> None:
        super().__init__(0, len(headers))
        self.setHorizontalHeaderLabels(headers)
        self.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setAlternatingRowColors(True)
        self.verticalHeader().setVisible(False)
        self.setShowGrid(False)
        hdr = self.horizontalHeader()
        hdr.setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        for i in range(1, len(headers)):
            hdr.setSectionResizeMode(i, QHeaderView.ResizeMode.ResizeToContents)
        if len(headers) >= 2:
            hdr.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)

    def populate(self, rows: list[list[str]]) -> None:
        self.setRowCount(len(rows))
        for r, row_data in enumerate(rows):
            self.setRowHeight(r, 30)
            for c, cell in enumerate(row_data):
                item = QTableWidgetItem(cell)
                align = Qt.AlignmentFlag.AlignVCenter
                align |= (
                    Qt.AlignmentFlag.AlignLeft if c == 0
                    else Qt.AlignmentFlag.AlignRight
                )
                item.setTextAlignment(align)
                self.setItem(r, c, item)


class _CategoryCard(QWidget):
    """One row card: coloured dot + category + quantity + spend."""

    def __init__(self, category: str, quantity_str: str, spend: float) -> None:
        super().__init__()
        self.setFixedHeight(44)
        colour = _CATEGORY_COLOURS.get(category, "#6c7086")

        layout = QHBoxLayout(self)
        layout.setContentsMargins(12, 0, 12, 0)
        layout.setSpacing(10)

        dot = QLabel("●")
        dot.setStyleSheet(f"color: {colour}; font-size: 10px; background: transparent;")
        layout.addWidget(dot)

        cat_lbl = QLabel(category)
        cat_lbl.setFixedWidth(140)
        cat_lbl.setStyleSheet("color: #cdd6f4; font-size: 13px; background: transparent;")
        layout.addWidget(cat_lbl)

        qty_lbl = QLabel(quantity_str)
        qty_lbl.setFixedWidth(120)
        qty_lbl.setStyleSheet(
            f"color: {colour}; font-size: 13px; font-weight: bold; background: transparent;"
        )
        qty_lbl.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        layout.addWidget(qty_lbl)

        spend_lbl = QLabel(f"NOK {spend:>10,.0f}")
        spend_lbl.setStyleSheet("color: #6c7086; font-size: 12px; background: transparent;")
        spend_lbl.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        layout.addWidget(spend_lbl)


class MaterialSummaryTab(QWidget):
    """Material intelligence summary with reports."""

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
        title = QLabel("Material Summary")
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

        # Scrollable body
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        body = QWidget()
        self._body_layout = QVBoxLayout(body)
        self._body_layout.setContentsMargins(28, 20, 28, 28)
        self._body_layout.setSpacing(16)

        # ── Material Summary cards ─────────────────────────────────────
        self._body_layout.addWidget(_SectionLabel("Material Summary"))
        self._cards_container = QWidget()
        self._cards_layout = QVBoxLayout(self._cards_container)
        self._cards_layout.setContentsMargins(0, 0, 0, 0)
        self._cards_layout.setSpacing(2)
        self._body_layout.addWidget(self._cards_container)

        sep1 = QFrame()
        sep1.setFrameShape(QFrame.Shape.HLine)
        sep1.setStyleSheet("color: #313244; margin-top: 8px;")
        self._body_layout.addWidget(sep1)

        # ── Spend by Material Category ─────────────────────────────────
        self._body_layout.addWidget(_SectionLabel("Spend by Material Category"))
        self._tbl_spend = _ReportTable(
            ["Category", "Total Spend (NOK)", "Items"]
        )
        self._tbl_spend.setFixedHeight(320)
        self._body_layout.addWidget(self._tbl_spend)

        sep2 = QFrame()
        sep2.setFrameShape(QFrame.Shape.HLine)
        sep2.setStyleSheet("color: #313244; margin-top: 8px;")
        self._body_layout.addWidget(sep2)

        # ── Top Products by Quantity ───────────────────────────────────
        self._body_layout.addWidget(_SectionLabel("Top 50 Products by Quantity"))
        self._tbl_top_qty = _ReportTable(
            ["Product", "Category", "Unit", "Total Qty", "Spend (NOK)", "Rows"]
        )
        self._tbl_top_qty.setFixedHeight(440)
        self._body_layout.addWidget(self._tbl_top_qty)

        sep3 = QFrame()
        sep3.setFrameShape(QFrame.Shape.HLine)
        sep3.setStyleSheet("color: #313244; margin-top: 8px;")
        self._body_layout.addWidget(sep3)

        # ── Top Products by Spend ──────────────────────────────────────
        self._body_layout.addWidget(_SectionLabel("Top 50 Products by Spend"))
        self._tbl_top_spend = _ReportTable(
            ["Product", "Category", "Unit", "Total Qty", "Spend (NOK)", "Rows"]
        )
        self._tbl_top_spend.setFixedHeight(440)
        self._body_layout.addWidget(self._tbl_top_spend)

        self._body_layout.addStretch()
        scroll.setWidget(body)
        root.addWidget(scroll)

    # ── Refresh ────────────────────────────────────────────────────────

    def refresh(self) -> None:
        self._refresh_summary_cards()
        self._refresh_spend_table()
        self._refresh_top_qty_table()
        self._refresh_top_spend_table()

    def _refresh_summary_cards(self) -> None:
        # Clear existing cards
        while self._cards_layout.count():
            item = self._cards_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        rows = self._li_repo.find_material_summary()
        if not rows:
            empty = QLabel("No line items imported yet.")
            empty.setStyleSheet("color: #6c7086; font-size: 12px; background: transparent;")
            self._cards_layout.addWidget(empty)
            return

        for row in rows:
            cat   = row.get("material_category") or "Other"
            unit  = row.get("unit_type") or ""
            qty   = row.get("total_quantity") or 0.0
            spend = row.get("total_spend") or 0.0
            card  = _CategoryCard(cat, _fmt_qty(qty, unit), spend)
            self._cards_layout.addWidget(card)

    def _refresh_spend_table(self) -> None:
        rows = self._li_repo.find_spend_by_material()
        self._tbl_spend.populate([
            [
                r.get("material_category") or "—",
                f"{r.get('total_spend', 0):,.2f}",
                str(r.get("item_count", 0)),
            ]
            for r in rows
        ])

    def _refresh_top_qty_table(self) -> None:
        rows = self._li_repo.find_top_by_quantity(50)
        self._tbl_top_qty.populate([
            [
                r.get("raw_description") or "—",
                r.get("material_category") or "—",
                r.get("unit_type") or "—",
                _fmt_qty(r.get("total_quantity") or 0, r.get("unit_type") or ""),
                f"{r.get('total_spend', 0):,.2f}",
                str(r.get("occurrences", 0)),
            ]
            for r in rows
        ])

    def _refresh_top_spend_table(self) -> None:
        rows = self._li_repo.find_top_by_spend(50)
        self._tbl_top_spend.populate([
            [
                r.get("raw_description") or "—",
                r.get("material_category") or "—",
                r.get("unit_type") or "—",
                _fmt_qty(r.get("total_quantity") or 0, r.get("unit_type") or ""),
                f"{r.get('total_spend', 0):,.2f}",
                str(r.get("occurrences", 0)),
            ]
            for r in rows
        ])
