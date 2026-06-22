"""
Supplier Management screen.

Features:
  • Searchable table of all suppliers with category, country, invoices, spend
  • Add Supplier button → SupplierDialog
  • Edit button per row → SupplierDialog pre-filled
  • Real-time search filtering
"""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.models import Supplier
from app.database.repositories import AggregationRepository, SupplierRepository
from app.database.repositories.category_repo import CategoryRepository
from app.ui.dialogs.supplier_dialog import SupplierDialog


class SuppliersTab(QWidget):
    def __init__(
        self,
        supplier_repo: SupplierRepository,
        category_repo: CategoryRepository,
        agg_repo: AggregationRepository,
    ) -> None:
        super().__init__()
        self._sup_repo = supplier_repo
        self._cat_repo = category_repo
        self._agg_repo = agg_repo
        self._all_rows: list[dict] = []
        self._build_ui()
        self.refresh()

    # ── Build ─────────────────────────────────────────────────────────

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

        title = QLabel("Suppliers")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4; background: transparent;")
        h_layout.addWidget(title)

        h_layout.addStretch()

        self._search = QLineEdit()
        self._search.setPlaceholderText("Search suppliers...")
        self._search.setFixedWidth(240)
        self._search.textChanged.connect(self._apply_filter)
        h_layout.addWidget(self._search)

        add_btn = QPushButton("+ Add Supplier")
        add_btn.setObjectName("primary")
        add_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_btn.clicked.connect(self._on_add)
        h_layout.addWidget(add_btn)

        root.addWidget(header)

        # Body
        body = QWidget()
        b_layout = QVBoxLayout(body)
        b_layout.setContentsMargins(28, 20, 28, 20)
        b_layout.setSpacing(12)

        # Table
        self._table = QTableWidget(0, 7)
        self._table.setHorizontalHeaderLabels([
            "Supplier", "Category", "Country", "Invoices", "Total Spend (SEK)", "", ""
        ])
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
        hdr.setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)
        hdr.setSectionResizeMode(6, QHeaderView.ResizeMode.Fixed)
        self._table.setColumnWidth(5, 64)
        self._table.setColumnWidth(6, 64)
        b_layout.addWidget(self._table)

        # Footer count
        self._count_lbl = QLabel()
        self._count_lbl.setStyleSheet("color: #6c7086; font-size: 11px;")
        b_layout.addWidget(self._count_lbl)

        root.addWidget(body)

    # ── Data ──────────────────────────────────────────────────────────

    def refresh(self) -> None:
        self._all_rows = self._agg_repo.supplier_stats()
        self._apply_filter(self._search.text())

    def _apply_filter(self, text: str) -> None:
        text = text.lower().strip()
        rows = [
            r for r in self._all_rows
            if text in r["canonical_name"].lower()
            or text in r["category_name"].lower()
            or text in (r["country"] or "").lower()
        ] if text else self._all_rows

        self._populate_table(rows)
        visible = len(rows)
        total = len(self._all_rows)
        if text:
            self._count_lbl.setText(f"Showing {visible} of {total} suppliers")
        else:
            self._count_lbl.setText(f"{total} supplier(s)")

    def _populate_table(self, rows: list[dict]) -> None:
        self._table.setRowCount(0)
        for row in rows:
            r = self._table.rowCount()
            self._table.insertRow(r)
            self._table.setRowHeight(r, 40)

            # Color swatch + name
            name_item = QTableWidgetItem(row["canonical_name"])
            name_item.setData(Qt.ItemDataRole.UserRole, row["id"])
            self._table.setItem(r, 0, name_item)

            # Category badge
            cat_item = QTableWidgetItem(row["category_name"])
            cat_item.setForeground(
                self._hex_to_qcolor(row.get("category_color", "#6c7086"))
            )
            self._table.setItem(r, 1, cat_item)

            self._table.setItem(r, 2, QTableWidgetItem(row["country"] or "—"))

            inv_item = QTableWidgetItem(str(row["invoice_count"]))
            inv_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._table.setItem(r, 3, inv_item)

            spend_item = QTableWidgetItem(f"{row['total_spend']:,.0f}")
            spend_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._table.setItem(r, 4, spend_item)

            # Edit button
            edit_btn = QPushButton("Edit")
            edit_btn.setFixedHeight(28)
            edit_btn.setStyleSheet(
                "QPushButton { background: #313244; border-radius: 4px; "
                "color: #89b4fa; font-size: 11px; padding: 0 8px; }"
                "QPushButton:hover { background: #45475a; }"
            )
            edit_btn.clicked.connect(lambda _, rid=row["id"]: self._on_edit(rid))
            self._table.setCellWidget(r, 5, self._center_widget(edit_btn))

            # Delete button
            del_btn = QPushButton("✕")
            del_btn.setFixedHeight(28)
            del_btn.setStyleSheet(
                "QPushButton { background: #313244; border-radius: 4px; "
                "color: #f38ba8; font-size: 11px; padding: 0 8px; }"
                "QPushButton:hover { background: #45475a; }"
            )
            del_btn.clicked.connect(lambda _, rid=row["id"]: self._on_delete(rid))
            self._table.setCellWidget(r, 6, self._center_widget(del_btn))

    # ── Actions ───────────────────────────────────────────────────────

    def _on_add(self) -> None:
        dlg = SupplierDialog(self._cat_repo, parent=self)
        if dlg.exec() == SupplierDialog.DialogCode.Accepted:
            data = dlg.get_data()
            self._sup_repo.save(Supplier(
                canonical_name=data["canonical_name"],
                normalized_key=data["normalized_key"],
                category_id=data["category_id"],
                country=data["country"],
                vat_number=data["vat_number"],
            ))
            self.refresh()

    def _on_edit(self, supplier_id: int) -> None:
        sup = self._sup_repo.find_by_id(supplier_id)
        if not sup:
            return
        dlg = SupplierDialog(self._cat_repo, supplier=sup, parent=self)
        if dlg.exec() == SupplierDialog.DialogCode.Accepted:
            data = dlg.get_data()
            sup.canonical_name = data["canonical_name"]
            sup.normalized_key = data["normalized_key"]
            sup.category_id    = data["category_id"]
            sup.country        = data["country"]
            sup.vat_number     = data["vat_number"]
            self._sup_repo.update(sup)
            self.refresh()

    def _on_delete(self, supplier_id: int) -> None:
        sup = self._sup_repo.find_by_id(supplier_id)
        if not sup:
            return
        reply = QMessageBox.question(
            self,
            "Delete Supplier",
            f"Delete <b>{sup.canonical_name}</b>?\n\n"
            "Associated invoices will lose their supplier link.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            self._sup_repo.delete(supplier_id)
            self.refresh()

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _hex_to_qcolor(hex_color: str):
        from PySide6.QtGui import QColor
        return QColor(hex_color)

    @staticmethod
    def _center_widget(widget: QWidget) -> QWidget:
        container = QWidget()
        layout = QHBoxLayout(container)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.addStretch()
        layout.addWidget(widget)
        layout.addStretch()
        return container
