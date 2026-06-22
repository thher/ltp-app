"""Dialog for adding or editing a category."""
from __future__ import annotations

from typing import Optional

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QVBoxLayout,
    QWidget,
)

from app.database.models import Category
from app.ui.style import CATEGORY_PALETTE


class CategoryDialog(QDialog):
    """
    Modal dialog for creating or editing a category.
    Pass ``category=None`` to open in Add mode.
    """

    def __init__(
        self,
        category: Optional[Category] = None,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._category = category
        self._is_edit = category is not None

        self.setWindowTitle("Edit Category" if self._is_edit else "Add Category")
        self.setMinimumWidth(400)
        self.setModal(True)
        self._build()
        if self._is_edit:
            self._populate()

    # ── Build ─────────────────────────────────────────────────────────

    def _build(self) -> None:
        root = QVBoxLayout(self)
        root.setSpacing(16)
        root.setContentsMargins(24, 20, 24, 20)

        title = QLabel("Edit Category" if self._is_edit else "Add New Category")
        title.setStyleSheet("font-size: 15px; font-weight: bold; color: #cdd6f4;")
        root.addWidget(title)

        form = QFormLayout()
        form.setSpacing(10)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self._name_edit = QLineEdit()
        self._name_edit.setPlaceholderText("e.g. Auto Parts")
        form.addRow("Name *", self._name_edit)

        self._desc_edit = QLineEdit()
        self._desc_edit.setPlaceholderText("Optional description")
        form.addRow("Description", self._desc_edit)

        self._color_combo = QComboBox()
        for hex_color, color_name in CATEGORY_PALETTE:
            self._color_combo.addItem(f"● {color_name}", hex_color)
        # Style each item with its color
        for i, (hex_color, _) in enumerate(CATEGORY_PALETTE):
            self._color_combo.setItemData(
                i, hex_color, Qt.ItemDataRole.UserRole
            )
        form.addRow("Color", self._color_combo)

        root.addLayout(form)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save
            | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        save_btn = buttons.button(QDialogButtonBox.StandardButton.Save)
        if save_btn:
            save_btn.setObjectName("primary")
        root.addWidget(buttons)

    def _populate(self) -> None:
        c = self._category
        self._name_edit.setText(c.name)
        if c.description:
            self._desc_edit.setText(c.description)
        if c.color:
            idx = self._color_combo.findData(c.color)
            if idx >= 0:
                self._color_combo.setCurrentIndex(idx)

    # ── Validation ────────────────────────────────────────────────────

    def _on_accept(self) -> None:
        if not self._name_edit.text().strip():
            QMessageBox.warning(self, "Validation", "Category name is required.")
            self._name_edit.setFocus()
            return
        self.accept()

    def get_data(self) -> dict:
        return {
            "name": self._name_edit.text().strip(),
            "description": self._desc_edit.text().strip() or None,
            "color": self._color_combo.currentData(),
        }
