"""
Supplier Dashboard — default landing page.

Shows:
  • KPI row: Total Suppliers, Total Invoices, Total Spend, Categories
  • Top Suppliers by Spend
  • Top Suppliers by Invoice Count
  • Spend by Category

When the database is empty an empty-state panel is shown with a
"Load Demo Data" button that emits ``seed_requested``.
"""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QPushButton,
    QScrollArea,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.repositories import AggregationRepository
from app.ui.widgets.metric_card import MetricCard


class _SectionLabel(QLabel):
    def __init__(self, text: str) -> None:
        super().__init__(text)
        font = QFont()
        font.setPointSize(11)
        font.setBold(True)
        self.setFont(font)
        self.setStyleSheet(
            "color: #a6adc8; letter-spacing: 0.5px; "
            "margin-top: 6px; background: transparent;"
        )


class _DataTable(QTableWidget):
    def __init__(self, headers: list[str]) -> None:
        super().__init__(0, len(headers))
        self.setHorizontalHeaderLabels(headers)
        self.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setAlternatingRowColors(True)
        self.verticalHeader().setVisible(False)
        self.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.setShowGrid(False)

    def populate(self, rows: list[list[str]]) -> None:
        self.setRowCount(len(rows))
        for r, row_data in enumerate(rows):
            for c, cell in enumerate(row_data):
                item = QTableWidgetItem(cell)
                item.setTextAlignment(
                    Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft
                )
                self.setItem(r, c, item)
        self.resizeRowsToContents()


class DashboardTab(QWidget):
    """Supplier Dashboard — application default landing page."""

    seed_requested = Signal()

    def __init__(self, aggregation_repo: Optional[AggregationRepository] = None) -> None:
        super().__init__()
        self._repo = aggregation_repo
        self._build_ui()
        self.refresh()

    # ── Build ─────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Page header bar
        header = QWidget()
        header.setFixedHeight(56)
        header.setStyleSheet("background: #181825; border-bottom: 1px solid #313244;")
        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(28, 0, 28, 0)
        title = QLabel("Supplier Dashboard")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4; background: transparent;")
        h_layout.addWidget(title)
        h_layout.addStretch()
        root.addWidget(header)

        # Stacked: empty state vs full dashboard
        self._stack = QStackedWidget()
        self._stack.addWidget(self._build_empty_state())   # index 0
        self._stack.addWidget(self._build_full_dashboard()) # index 1
        root.addWidget(self._stack)

    def _build_empty_state(self) -> QWidget:
        w = QWidget()
        layout = QVBoxLayout(w)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.setSpacing(16)

        icon = QLabel("📊")
        icon.setStyleSheet("font-size: 64px; background: transparent;")
        icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(icon)

        msg = QLabel("No data yet")
        font = QFont()
        font.setPointSize(18)
        font.setBold(True)
        msg.setFont(font)
        msg.setAlignment(Qt.AlignmentFlag.AlignCenter)
        msg.setStyleSheet("color: #cdd6f4; background: transparent;")
        layout.addWidget(msg)

        sub = QLabel(
            "Load demo data to explore the application,\n"
            "or import your first invoice to get started."
        )
        sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sub.setStyleSheet("color: #6c7086; font-size: 13px; background: transparent;")
        layout.addWidget(sub)

        load_btn = QPushButton("Load Demo Data")
        load_btn.setObjectName("primary")
        load_btn.setFixedWidth(180)
        load_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        load_btn.clicked.connect(self.seed_requested.emit)
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        btn_row.addWidget(load_btn)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        return w

    def _build_full_dashboard(self) -> QWidget:
        container = QWidget()
        outer = QVBoxLayout(container)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        body = QWidget()
        layout = QVBoxLayout(body)
        layout.setContentsMargins(28, 20, 28, 28)
        layout.setSpacing(20)

        # ── KPI row ───────────────────────────────────────────────────
        kpi_row = QHBoxLayout()
        kpi_row.setSpacing(14)
        self._card_suppliers  = MetricCard("Total Suppliers",  "0",    "#89b4fa")
        self._card_invoices   = MetricCard("Total Invoices",   "0",    "#a6e3a1")
        self._card_spend      = MetricCard("Total Spend (SEK)","0.00", "#fab387")
        self._card_categories = MetricCard("Categories",       "0",    "#cba6f7")
        for card in (self._card_suppliers, self._card_invoices,
                     self._card_spend, self._card_categories):
            kpi_row.addWidget(card)
        layout.addLayout(kpi_row)

        # ── Top suppliers by spend ────────────────────────────────────
        layout.addWidget(_SectionLabel("Top Suppliers by Spend"))
        self._tbl_top_spend = _DataTable(["Supplier", "Total Spend (SEK)", "Invoices"])
        self._tbl_top_spend.setFixedHeight(256)
        layout.addWidget(self._tbl_top_spend)

        # ── Top suppliers by invoice count ────────────────────────────
        layout.addWidget(_SectionLabel("Top Suppliers by Invoice Count"))
        self._tbl_top_count = _DataTable(["Supplier", "Invoices", "Total Spend (SEK)"])
        self._tbl_top_count.setFixedHeight(256)
        layout.addWidget(self._tbl_top_count)

        # ── Spend by category ─────────────────────────────────────────
        layout.addWidget(_SectionLabel("Spend by Category"))
        self._tbl_categories = _DataTable(
            ["Category", "Total Spend (SEK)", "Invoices", "Suppliers"]
        )
        self._tbl_categories.setFixedHeight(220)
        layout.addWidget(self._tbl_categories)

        layout.addStretch()
        scroll.setWidget(body)
        outer.addWidget(scroll)
        return container

    # ── Refresh ───────────────────────────────────────────────────────

    def refresh(self) -> None:
        if self._repo is None:
            self._stack.setCurrentIndex(0)
            return

        total_sup = self._repo.total_suppliers()

        if total_sup == 0:
            self._stack.setCurrentIndex(0)
            return

        self._stack.setCurrentIndex(1)

        total_inv   = self._repo.total_invoices()
        total_spend = self._repo.total_spend()
        total_cats  = self._repo.total_categories()
        avg_inv     = total_spend / total_inv if total_inv else 0.0

        self._card_suppliers.set_value(f"{total_sup:,}")
        self._card_invoices.set_value(f"{total_inv:,}")
        self._card_spend.set_value(f"{total_spend:,.0f}")
        self._card_spend.set_subtitle(f"Avg {avg_inv:,.0f} / invoice")
        self._card_categories.set_value(str(total_cats))

        by_spend = self._repo.top_suppliers_by_spend(10)
        self._tbl_top_spend.populate([
            [r["canonical_name"],
             f"{r['total_gross']:,.0f}",
             str(r["invoice_count"])]
            for r in by_spend
        ])

        by_count = self._repo.top_suppliers_by_invoice_count(10)
        self._tbl_top_count.populate([
            [r["canonical_name"],
             str(r["invoice_count"]),
             f"{r['total_gross']:,.0f}"]
            for r in by_count
        ])

        cats = self._repo.spend_by_category()
        self._tbl_categories.populate([
            [r["name"],
             f"{r['total_gross']:,.0f}",
             str(r["invoice_count"]),
             str(r["supplier_count"])]
            for r in cats
        ])
