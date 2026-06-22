"""
Category Management screen.

Features:
  • List of categories with color indicators
  • Add / Rename / Delete a category
  • Right panel shows suppliers in the selected category
  • "Assign Suppliers" button opens AssignSuppliersDialog
"""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from app.database.models import Category
from app.database.repositories.category_repo import CategoryRepository
from app.database.repositories.supplier_repo import SupplierRepository
from app.ui.dialogs.assign_suppliers_dialog import AssignSuppliersDialog
from app.ui.dialogs.category_dialog import CategoryDialog


class CategoriesTab(QWidget):
    def __init__(
        self,
        category_repo: CategoryRepository,
        supplier_repo: SupplierRepository,
    ) -> None:
        super().__init__()
        self._cat_repo = category_repo
        self._sup_repo = supplier_repo
        self._selected_category: Optional[Category] = None
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

        title = QLabel("Categories")
        font = QFont()
        font.setPointSize(14)
        font.setBold(True)
        title.setFont(font)
        title.setStyleSheet("color: #cdd6f4; background: transparent;")
        h_layout.addWidget(title)
        h_layout.addStretch()

        add_btn = QPushButton("+ Add Category")
        add_btn.setObjectName("primary")
        add_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_btn.clicked.connect(self._on_add)
        h_layout.addWidget(add_btn)

        root.addWidget(header)

        # Two-panel body
        body = QWidget()
        body_layout = QHBoxLayout(body)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        # ── Left panel: category list ─────────────────────────────────
        left = QWidget()
        left.setFixedWidth(280)
        left.setStyleSheet("background: #181825; border-right: 1px solid #313244;")
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(16, 16, 16, 16)
        left_layout.setSpacing(8)

        list_title = QLabel("All Categories")
        list_title.setStyleSheet(
            "color: #a6adc8; font-size: 11px; font-weight: bold; "
            "letter-spacing: 0.5px; background: transparent;"
        )
        left_layout.addWidget(list_title)

        self._cat_list = QListWidget()
        self._cat_list.setStyleSheet("""
            QListWidget {
                background: #1e1e2e;
                border: 1px solid #313244;
                border-radius: 8px;
            }
            QListWidget::item {
                padding: 10px 12px;
                border-radius: 4px;
            }
            QListWidget::item:selected {
                background: #313244;
            }
        """)
        self._cat_list.currentItemChanged.connect(self._on_category_selected)
        left_layout.addWidget(self._cat_list)

        # Action buttons row
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)

        self._rename_btn = QPushButton("Rename")
        self._rename_btn.setEnabled(False)
        self._rename_btn.clicked.connect(self._on_rename)
        btn_row.addWidget(self._rename_btn)

        self._delete_btn = QPushButton("Delete")
        self._delete_btn.setObjectName("danger")
        self._delete_btn.setEnabled(False)
        self._delete_btn.clicked.connect(self._on_delete)
        btn_row.addWidget(self._delete_btn)

        left_layout.addLayout(btn_row)
        body_layout.addWidget(left)

        # ── Right panel: suppliers in category ────────────────────────
        right = QWidget()
        right_layout = QVBoxLayout(right)
        right_layout.setContentsMargins(28, 20, 28, 20)
        right_layout.setSpacing(12)

        # Right header
        right_header = QHBoxLayout()
        self._detail_title = QLabel("Select a category")
        font2 = QFont()
        font2.setPointSize(13)
        font2.setBold(True)
        self._detail_title.setFont(font2)
        self._detail_title.setStyleSheet("color: #cdd6f4; background: transparent;")
        right_header.addWidget(self._detail_title)
        right_header.addStretch()

        self._assign_btn = QPushButton("Assign Suppliers...")
        self._assign_btn.setEnabled(False)
        self._assign_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._assign_btn.clicked.connect(self._on_assign)
        right_header.addWidget(self._assign_btn)
        right_layout.addLayout(right_header)

        # Supplier table for this category
        self._sup_table = QTableWidget(0, 4)
        self._sup_table.setHorizontalHeaderLabels(
            ["Supplier", "Country", "Invoices", "Total Spend (SEK)"]
        )
        self._sup_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self._sup_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self._sup_table.setAlternatingRowColors(True)
        self._sup_table.verticalHeader().setVisible(False)
        self._sup_table.setShowGrid(False)
        hdr = self._sup_table.horizontalHeader()
        hdr.setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        hdr.setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        hdr.setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        right_layout.addWidget(self._sup_table)

        self._sup_count_lbl = QLabel()
        self._sup_count_lbl.setStyleSheet("color: #6c7086; font-size: 11px;")
        right_layout.addWidget(self._sup_count_lbl)

        body_layout.addWidget(right)
        root.addWidget(body)

    # ── Data ──────────────────────────────────────────────────────────

    def refresh(self) -> None:
        selected_id = (
            self._selected_category.id
            if self._selected_category else None
        )
        categories = self._cat_repo.find_all()
        self._cat_list.clear()

        for cat in categories:
            item = QListWidgetItem(f"  {cat.name}")
            item.setData(Qt.ItemDataRole.UserRole, cat.id)
            if cat.color:
                item.setForeground(QColor(cat.color))
            self._cat_list.addItem(item)

        # Re-select previously selected category
        if selected_id is not None:
            for i in range(self._cat_list.count()):
                if self._cat_list.item(i).data(Qt.ItemDataRole.UserRole) == selected_id:
                    self._cat_list.setCurrentRow(i)
                    break
        else:
            self._refresh_supplier_panel()

    def _on_category_selected(
        self, current: Optional[QListWidgetItem], _prev
    ) -> None:
        if current is None:
            self._selected_category = None
            self._rename_btn.setEnabled(False)
            self._delete_btn.setEnabled(False)
            self._assign_btn.setEnabled(False)
            self._detail_title.setText("Select a category")
            self._sup_table.setRowCount(0)
            self._sup_count_lbl.clear()
            return

        cat_id = current.data(Qt.ItemDataRole.UserRole)
        self._selected_category = self._cat_repo.find_by_id(cat_id)
        self._rename_btn.setEnabled(True)
        self._delete_btn.setEnabled(True)
        self._assign_btn.setEnabled(True)
        self._refresh_supplier_panel()

    def _refresh_supplier_panel(self) -> None:
        if self._selected_category is None:
            self._sup_table.setRowCount(0)
            return

        cat = self._selected_category
        self._detail_title.setText(cat.name)
        suppliers = self._sup_repo.find_by_category(cat.id)

        self._sup_table.setRowCount(0)
        for sup in suppliers:
            r = self._sup_table.rowCount()
            self._sup_table.insertRow(r)
            self._sup_table.setRowHeight(r, 38)
            self._sup_table.setItem(r, 0, QTableWidgetItem(sup.canonical_name))
            self._sup_table.setItem(r, 1, QTableWidgetItem(sup.country or "—"))
            # Invoice count / spend come from AggregationRepository but to keep
            # this widget lean we show placeholders for now
            count_item = QTableWidgetItem("—")
            count_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._sup_table.setItem(r, 2, count_item)
            spend_item = QTableWidgetItem("—")
            spend_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self._sup_table.setItem(r, 3, spend_item)

        n = len(suppliers)
        self._sup_count_lbl.setText(
            f"{n} supplier{'s' if n != 1 else ''} in this category"
        )

    # ── Actions ───────────────────────────────────────────────────────

    def _on_add(self) -> None:
        dlg = CategoryDialog(parent=self)
        if dlg.exec() == CategoryDialog.DialogCode.Accepted:
            data = dlg.get_data()
            self._cat_repo.save(
                Category(name=data["name"], description=data["description"],
                         color=data["color"])
            )
            self.refresh()

    def _on_rename(self) -> None:
        if not self._selected_category:
            return
        dlg = CategoryDialog(category=self._selected_category, parent=self)
        if dlg.exec() == CategoryDialog.DialogCode.Accepted:
            data = dlg.get_data()
            self._selected_category.name        = data["name"]
            self._selected_category.description = data["description"]
            self._selected_category.color       = data["color"]
            self._cat_repo.update(self._selected_category)
            self.refresh()

    def _on_delete(self) -> None:
        if not self._selected_category:
            return
        cat = self._selected_category
        suppliers = self._sup_repo.find_by_category(cat.id)
        reply = QMessageBox.question(
            self,
            "Delete Category",
            f"Delete <b>{cat.name}</b>?\n\n"
            + (
                f"{len(suppliers)} supplier(s) will become uncategorized."
                if suppliers else ""
            ),
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply == QMessageBox.StandardButton.Yes:
            self._cat_repo.delete(cat.id)
            self._selected_category = None
            self.refresh()

    def _on_assign(self) -> None:
        if not self._selected_category:
            return
        dlg = AssignSuppliersDialog(
            self._selected_category, self._sup_repo, parent=self
        )
        if dlg.exec() == AssignSuppliersDialog.DialogCode.Accepted:
            selected_ids = set(dlg.get_selected_ids())
            # Update all suppliers: assign or unassign from this category
            for sup in self._sup_repo.find_all():
                if sup.id in selected_ids:
                    if sup.category_id != self._selected_category.id:
                        sup.category_id = self._selected_category.id
                        self._sup_repo.update(sup)
                elif sup.category_id == self._selected_category.id:
                    sup.category_id = None
                    self._sup_repo.update(sup)
            self.refresh()
