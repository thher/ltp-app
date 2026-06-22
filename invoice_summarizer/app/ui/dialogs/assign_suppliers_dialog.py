"""Dialog for assigning multiple suppliers to a category."""
from __future__ import annotations

from typing import Optional

from PySide6.QtWidgets import (
    QCheckBox,
    QDialog,
    QDialogButtonBox,
    QLabel,
    QLineEdit,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from app.database.models import Category
from app.database.repositories.supplier_repo import SupplierRepository


class AssignSuppliersDialog(QDialog):
    """
    Shows all suppliers as a scrollable checklist.
    Pre-checks suppliers already in ``category``.
    Returns a list of supplier IDs to assign.
    """

    def __init__(
        self,
        category: Category,
        supplier_repo: SupplierRepository,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._category = category
        self._repo = supplier_repo
        self._checkboxes: list[tuple[int, QCheckBox]] = []

        self.setWindowTitle(f"Assign Suppliers — {category.name}")
        self.setMinimumSize(380, 480)
        self.setModal(True)
        self._build()

    # ── Build ─────────────────────────────────────────────────────────

    def _build(self) -> None:
        root = QVBoxLayout(self)
        root.setSpacing(12)
        root.setContentsMargins(20, 18, 20, 18)

        title = QLabel(f"Assign suppliers to <b>{self._category.name}</b>")
        title.setStyleSheet("font-size: 14px; color: #cdd6f4;")
        root.addWidget(title)

        # Search
        self._search = QLineEdit()
        self._search.setPlaceholderText("Filter suppliers...")
        self._search.textChanged.connect(self._filter)
        root.addWidget(self._search)

        # Scrollable checklist
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("QScrollArea { border: 1px solid #313244; border-radius: 8px; }")

        self._list_widget = QWidget()
        self._list_layout = QVBoxLayout(self._list_widget)
        self._list_layout.setContentsMargins(12, 8, 12, 8)
        self._list_layout.setSpacing(4)

        all_suppliers = self._repo.find_all()
        for sup in all_suppliers:
            cb = QCheckBox(sup.canonical_name)
            cb.setChecked(sup.category_id == self._category.id)
            self._checkboxes.append((sup.id, cb))
            self._list_layout.addWidget(cb)

        self._list_layout.addStretch()
        scroll.setWidget(self._list_widget)
        root.addWidget(scroll)

        # Count label
        self._count_lbl = QLabel()
        self._count_lbl.setStyleSheet("color: #6c7086; font-size: 11px;")
        self._update_count()
        root.addWidget(self._count_lbl)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save
            | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        save_btn = buttons.button(QDialogButtonBox.StandardButton.Save)
        if save_btn:
            save_btn.setObjectName("primary")
            save_btn.setText("Assign")
        root.addWidget(buttons)

        # Connect checkboxes to count update
        for _, cb in self._checkboxes:
            cb.stateChanged.connect(self._update_count)

    def _filter(self, text: str) -> None:
        text = text.lower()
        for sup_id, cb in self._checkboxes:
            cb.setVisible(text in cb.text().lower())

    def _update_count(self) -> None:
        n = sum(1 for _, cb in self._checkboxes if cb.isChecked())
        self._count_lbl.setText(f"{n} supplier(s) selected")

    # ── Result ────────────────────────────────────────────────────────

    def get_selected_ids(self) -> list[int]:
        return [sup_id for sup_id, cb in self._checkboxes if cb.isChecked()]
