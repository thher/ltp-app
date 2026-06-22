"""
Supplier Dashboard — default landing page.

Displays:
  • KPI row: Total Suppliers, Total Invoices, Total Spend, Avg Invoice Value
  • Top Suppliers by Spend  (table, top 10)
  • Top Suppliers by Invoice Count (table, top 10)
  • Spend by Category (table)

All data comes from AggregationRepository queries.
Phase 1: layout wired up, all values show zero / empty until invoices are imported.
"""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QScrollArea,
    QSizePolicy,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.repositories import AggregationRepository


class _MetricCard(QFrame):
    """Single KPI tile: label on top, large value below."""

    def __init__(self, title: str, value: str = "0", accent: str = "#4A90E2") -> None:
        super().__init__()
        self.setFrameShape(QFrame.Shape.StyledPanel)
        self.setObjectName("MetricCard")
        self.setStyleSheet(f"""
            #MetricCard {{
                background: #1e1e2e;
                border: 1px solid #313244;
                border-radius: 8px;
            }}
            #MetricCard:hover {{
                border: 1px solid {accent};
            }}
        """)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setMinimumHeight(100)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(4)

        title_label = QLabel(title)
        title_label.setStyleSheet("color: #a6adc8; font-size: 12px;")
        layout.addWidget(title_label)

        self._value_label = QLabel(value)
        font = QFont()
        font.setPointSize(22)
        font.setBold(True)
        self._value_label.setFont(font)
        self._value_label.setStyleSheet(f"color: {accent};")
        layout.addWidget(self._value_label)

    def set_value(self, value: str) -> None:
        self._value_label.setText(value)


class _SectionLabel(QLabel):
    def __init__(self, text: str) -> None:
        super().__init__(text)
        font = QFont()
        font.setPointSize(13)
        font.setBold(True)
        self.setFont(font)
        self.setStyleSheet("color: #cdd6f4; margin-top: 8px;")


class _DataTable(QTableWidget):
    """Styled read-only table for dashboard sections."""

    def __init__(self, headers: list[str]) -> None:
        super().__init__(0, len(headers))
        self.setHorizontalHeaderLabels(headers)
        self.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setAlternatingRowColors(True)
        self.verticalHeader().setVisible(False)
        self.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch
        )
        self.setStyleSheet("""
            QTableWidget {
                background: #1e1e2e;
                alternate-background-color: #181825;
                color: #cdd6f4;
                gridline-color: #313244;
                border: 1px solid #313244;
                border-radius: 6px;
            }
            QHeaderView::section {
                background: #313244;
                color: #a6adc8;
                padding: 6px;
                border: none;
                font-weight: bold;
            }
            QTableWidget::item:selected {
                background: #45475a;
            }
        """)

    def populate(self, rows: list[list[str]]) -> None:
        self.setRowCount(len(rows))
        for r_idx, row in enumerate(rows):
            for c_idx, cell in enumerate(row):
                item = QTableWidgetItem(cell)
                item.setTextAlignment(
                    Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft
                )
                self.setItem(r_idx, c_idx, item)


class DashboardTab(QWidget):
    """
    Supplier Dashboard — the application's default landing page.
    Call refresh() to reload all data from the database.
    """

    def __init__(self, aggregation_repo: Optional[AggregationRepository] = None) -> None:
        super().__init__()
        self._repo = aggregation_repo
        self._build_ui()
        self.refresh()

    # ── Build ─────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        self.setStyleSheet("background: #11111b;")

        root = QVBoxLayout(self)
        root.setContentsMargins(24, 20, 24, 20)
        root.setSpacing(20)

        # Page title
        title = QLabel("Supplier Dashboard")
        font = QFont()
        font.setPointSize(18)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4;")
        root.addWidget(title)

        # ── KPI row ───────────────────────────────────────────────────
        kpi_row = QHBoxLayout()
        kpi_row.setSpacing(16)

        self._card_suppliers = _MetricCard("Total Suppliers", "0", "#89b4fa")
        self._card_invoices = _MetricCard("Total Invoices", "0", "#a6e3a1")
        self._card_spend = _MetricCard("Total Spend", "0.00", "#fab387")
        self._card_avg = _MetricCard("Avg Invoice Value", "0.00", "#f38ba8")

        for card in (
            self._card_suppliers,
            self._card_invoices,
            self._card_spend,
            self._card_avg,
        ):
            kpi_row.addWidget(card)

        root.addLayout(kpi_row)

        # ── Scrollable body ───────────────────────────────────────────
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setStyleSheet("background: transparent;")

        body = QWidget()
        body.setStyleSheet("background: transparent;")
        body_layout = QVBoxLayout(body)
        body_layout.setSpacing(12)
        body_layout.setContentsMargins(0, 0, 0, 0)

        # ── Top suppliers by spend ────────────────────────────────────
        body_layout.addWidget(_SectionLabel("Top Suppliers by Spend"))
        self._table_top_spend = _DataTable(
            ["Supplier", "Total Spend", "Invoice Count"]
        )
        self._table_top_spend.setFixedHeight(240)
        body_layout.addWidget(self._table_top_spend)

        # ── Top suppliers by invoice count ────────────────────────────
        body_layout.addWidget(_SectionLabel("Top Suppliers by Invoice Count"))
        self._table_top_count = _DataTable(
            ["Supplier", "Invoice Count", "Total Spend"]
        )
        self._table_top_count.setFixedHeight(240)
        body_layout.addWidget(self._table_top_count)

        # ── Spend by category ─────────────────────────────────────────
        body_layout.addWidget(_SectionLabel("Spend by Category"))
        self._table_categories = _DataTable(
            ["Category", "Total Spend", "Invoices", "Suppliers"]
        )
        self._table_categories.setFixedHeight(200)
        body_layout.addWidget(self._table_categories)

        body_layout.addStretch()
        scroll.setWidget(body)
        root.addWidget(scroll)

    # ── Refresh ───────────────────────────────────────────────────────

    def refresh(self) -> None:
        if self._repo is None:
            self._show_empty_state()
            return

        total_suppliers = self._repo.total_suppliers()
        total_invoices = self._repo.total_invoices()
        total_spend = self._repo.total_spend()
        avg_invoice = total_spend / total_invoices if total_invoices else 0.0

        self._card_suppliers.set_value(str(total_suppliers))
        self._card_invoices.set_value(str(total_invoices))
        self._card_spend.set_value(f"{total_spend:,.2f}")
        self._card_avg.set_value(f"{avg_invoice:,.2f}")

        by_spend = self._repo.top_suppliers_by_spend(10)
        self._table_top_spend.populate([
            [r["canonical_name"], f"{r['total_gross']:,.2f}", str(r["invoice_count"])]
            for r in by_spend
        ])

        by_count = self._repo.top_suppliers_by_invoice_count(10)
        self._table_top_count.populate([
            [r["canonical_name"], str(r["invoice_count"]), f"{r['total_gross']:,.2f}"]
            for r in by_count
        ])

        categories = self._repo.spend_by_category()
        self._table_categories.populate([
            [
                r["name"],
                f"{r['total_gross']:,.2f}",
                str(r["invoice_count"]),
                str(r["supplier_count"]),
            ]
            for r in categories
        ])

    def _show_empty_state(self) -> None:
        self._card_suppliers.set_value("—")
        self._card_invoices.set_value("—")
        self._card_spend.set_value("—")
        self._card_avg.set_value("—")
        self._table_top_spend.populate([])
        self._table_top_count.populate([])
        self._table_categories.populate([])
