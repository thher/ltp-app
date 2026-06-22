"""Dialog for adding or editing a supplier."""
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

from app.database.models import Supplier
from app.database.repositories.category_repo import CategoryRepository


class SupplierDialog(QDialog):
    """
    Modal dialog for creating or editing a supplier.

    Pass ``supplier=None`` to open in Add mode.
    Pass a ``Supplier`` instance to open in Edit mode.
    """

    def __init__(
        self,
        category_repo: CategoryRepository,
        supplier: Optional[Supplier] = None,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._cat_repo = category_repo
        self._supplier = supplier
        self._is_edit = supplier is not None

        self.setWindowTitle("Edit Supplier" if self._is_edit else "Add Supplier")
        self.setMinimumWidth(420)
        self.setModal(True)
        self._build()
        if self._is_edit:
            self._populate()

    # ── Build ─────────────────────────────────────────────────────────

    def _build(self) -> None:
        root = QVBoxLayout(self)
        root.setSpacing(16)
        root.setContentsMargins(24, 20, 24, 20)

        # Title
        title = QLabel("Edit Supplier" if self._is_edit else "Add New Supplier")
        title.setStyleSheet("font-size: 15px; font-weight: bold; color: #cdd6f4;")
        root.addWidget(title)

        # Form
        form = QFormLayout()
        form.setSpacing(10)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self._name_edit = QLineEdit()
        self._name_edit.setPlaceholderText("e.g. Biltema")
        form.addRow("Name *", self._name_edit)

        self._category_combo = QComboBox()
        self._category_combo.addItem("— Uncategorized —", None)
        for cat in self._cat_repo.find_all():
            self._category_combo.addItem(cat.name, cat.id)
        form.addRow("Category", self._category_combo)

        self._country_edit = QLineEdit()
        self._country_edit.setPlaceholderText("e.g. SE")
        self._country_edit.setMaxLength(2)
        form.addRow("Country", self._country_edit)

        self._vat_edit = QLineEdit()
        self._vat_edit.setPlaceholderText("e.g. SE123456789001")
        form.addRow("VAT Number", self._vat_edit)

        root.addLayout(form)

        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Save
            | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        # Style the Save button as primary
        save_btn = buttons.button(QDialogButtonBox.StandardButton.Save)
        if save_btn:
            save_btn.setObjectName("primary")
        root.addWidget(buttons)

    def _populate(self) -> None:
        s = self._supplier
        self._name_edit.setText(s.canonical_name)
        if s.country:
            self._country_edit.setText(s.country)
        if s.vat_number:
            self._vat_edit.setText(s.vat_number)
        if s.category_id is not None:
            idx = self._category_combo.findData(s.category_id)
            if idx >= 0:
                self._category_combo.setCurrentIndex(idx)

    # ── Validation & result ───────────────────────────────────────────

    def _on_accept(self) -> None:
        name = self._name_edit.text().strip()
        if not name:
            QMessageBox.warning(self, "Validation", "Supplier name is required.")
            self._name_edit.setFocus()
            return
        self.accept()

    def get_data(self) -> dict:
        """Returns validated form data. Call only after accept()."""
        return {
            "canonical_name": self._name_edit.text().strip(),
            "normalized_key": self._name_edit.text().strip().lower(),
            "category_id": self._category_combo.currentData(),
            "country": self._country_edit.text().strip().upper() or None,
            "vat_number": self._vat_edit.text().strip() or None,
        }
