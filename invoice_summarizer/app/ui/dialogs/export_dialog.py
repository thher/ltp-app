"""Export dialog — choose format, filters, and output folder."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from PySide6.QtCore import QDate, Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDateEdit,
    QDialog,
    QFileDialog,
    QFormLayout,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from app.export.excel_exporter import ExcelExporter
from app.export.export_service import ExportService
from app.export.pdf_exporter import PDFReportExporter
from app.processing.material_classifier import MaterialCategory
from app.database.repositories.supplier_repo import SupplierRepository


class ExportDialog(QDialog):
    """Modal dialog for configuring and running an export."""

    def __init__(
        self,
        export_service: ExportService,
        sup_repo: SupplierRepository,
        parent: Optional[QWidget] = None,
    ) -> None:
        super().__init__(parent)
        self._svc     = export_service
        self._sup_repo = sup_repo
        self.setWindowTitle("Export Data")
        self.setMinimumWidth(520)
        self.setModal(True)
        self._build_ui()
        self._populate_suppliers()

    # ── Build ─────────────────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        root = QVBoxLayout(self)
        root.setSpacing(20)
        root.setContentsMargins(28, 24, 28, 24)

        # Title
        title = QLabel("Export Data")
        title.setStyleSheet("font-size: 16px; font-weight: bold; color: #cdd6f4;")
        root.addWidget(title)

        sub = QLabel(
            "Choose filters, output format, and destination folder.\n"
            "Filters are applied to both export files."
        )
        sub.setStyleSheet("color: #a6adc8; font-size: 12px;")
        sub.setWordWrap(True)
        root.addWidget(sub)

        root.addWidget(_divider())

        # ── Filters section ───────────────────────────────────────────────────
        filter_lbl = QLabel("Filters")
        filter_lbl.setStyleSheet("font-size: 12px; font-weight: bold; color: #89b4fa;")
        root.addWidget(filter_lbl)

        form = QFormLayout()
        form.setSpacing(10)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        # Date from
        date_from_row = QHBoxLayout()
        self._chk_date_from = QCheckBox()
        self._chk_date_from.setChecked(False)
        self._date_from = QDateEdit(QDate.currentDate().addYears(-1))
        self._date_from.setCalendarPopup(True)
        self._date_from.setDisplayFormat("yyyy-MM-dd")
        self._date_from.setEnabled(False)
        self._chk_date_from.toggled.connect(self._date_from.setEnabled)
        date_from_row.addWidget(self._chk_date_from)
        date_from_row.addWidget(self._date_from)
        date_from_row.addStretch()
        form.addRow("From date", date_from_row)

        # Date to
        date_to_row = QHBoxLayout()
        self._chk_date_to = QCheckBox()
        self._chk_date_to.setChecked(False)
        self._date_to = QDateEdit(QDate.currentDate())
        self._date_to.setCalendarPopup(True)
        self._date_to.setDisplayFormat("yyyy-MM-dd")
        self._date_to.setEnabled(False)
        self._chk_date_to.toggled.connect(self._date_to.setEnabled)
        date_to_row.addWidget(self._chk_date_to)
        date_to_row.addWidget(self._date_to)
        date_to_row.addStretch()
        form.addRow("To date", date_to_row)

        # Supplier filter
        self._supplier_combo = QComboBox()
        self._supplier_combo.addItem("All Suppliers", None)
        form.addRow("Supplier", self._supplier_combo)

        # Material category filter
        self._category_combo = QComboBox()
        self._category_combo.addItem("All Categories", None)
        for cat in MaterialCategory:
            if cat != MaterialCategory.OTHER:
                self._category_combo.addItem(cat.value, cat.value)
        self._category_combo.addItem(MaterialCategory.OTHER.value, MaterialCategory.OTHER.value)
        form.addRow("Material category", self._category_combo)

        root.addLayout(form)
        root.addWidget(_divider())

        # ── Format section ────────────────────────────────────────────────────
        fmt_lbl = QLabel("Output Format")
        fmt_lbl.setStyleSheet("font-size: 12px; font-weight: bold; color: #89b4fa;")
        root.addWidget(fmt_lbl)

        fmt_row = QHBoxLayout()
        self._chk_excel = QCheckBox("Excel (.xlsx)  — 6 sheets")
        self._chk_excel.setChecked(True)
        self._chk_pdf   = QCheckBox("PDF Report  — executive summary + tables")
        self._chk_pdf.setChecked(True)
        fmt_row.addWidget(self._chk_excel)
        fmt_row.addSpacing(24)
        fmt_row.addWidget(self._chk_pdf)
        fmt_row.addStretch()
        root.addLayout(fmt_row)

        root.addWidget(_divider())

        # ── Output folder ─────────────────────────────────────────────────────
        folder_lbl = QLabel("Output Folder")
        folder_lbl.setStyleSheet("font-size: 12px; font-weight: bold; color: #89b4fa;")
        root.addWidget(folder_lbl)

        folder_row = QHBoxLayout()
        self._folder_edit = QLineEdit()
        self._folder_edit.setPlaceholderText("Select output folder…")
        browse_btn = QPushButton("Browse…")
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        browse_btn.clicked.connect(self._browse_folder)
        folder_row.addWidget(self._folder_edit)
        folder_row.addWidget(browse_btn)
        root.addLayout(folder_row)

        # Status label
        self._status_lbl = QLabel("")
        self._status_lbl.setStyleSheet("color: #a6adc8; font-size: 11px;")
        self._status_lbl.setWordWrap(True)
        root.addWidget(self._status_lbl)

        # ── Buttons ───────────────────────────────────────────────────────────
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        cancel_btn = QPushButton("Cancel")
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.clicked.connect(self.reject)
        self._export_btn = QPushButton("Export")
        self._export_btn.setObjectName("primary")
        self._export_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self._export_btn.clicked.connect(self._do_export)
        btn_row.addWidget(cancel_btn)
        btn_row.addSpacing(8)
        btn_row.addWidget(self._export_btn)
        root.addLayout(btn_row)

    def _populate_suppliers(self) -> None:
        try:
            for sup in self._sup_repo.find_all():
                self._supplier_combo.addItem(sup.canonical_name, sup.id)
        except Exception:
            pass

    # ── Slots ─────────────────────────────────────────────────────────────────

    def _browse_folder(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Select Output Folder")
        if folder:
            self._folder_edit.setText(folder)

    def _do_export(self) -> None:
        # Validation
        if not self._chk_excel.isChecked() and not self._chk_pdf.isChecked():
            QMessageBox.warning(self, "Export", "Select at least one output format.")
            return

        folder_str = self._folder_edit.text().strip()
        if not folder_str:
            QMessageBox.warning(self, "Export", "Please select an output folder.")
            self._folder_edit.setFocus()
            return

        folder = Path(folder_str)
        if not folder.exists():
            QMessageBox.warning(self, "Export", f"Folder does not exist:\n{folder}")
            return

        # Gather filters
        date_from = (
            self._date_from.date().toPython()
            if self._chk_date_from.isChecked() else None
        )
        date_to = (
            self._date_to.date().toPython()
            if self._chk_date_to.isChecked() else None
        )
        supplier_id       = self._supplier_combo.currentData()
        material_category = self._category_combo.currentData()

        self._export_btn.setEnabled(False)
        self._status_lbl.setText("Gathering data…")

        try:
            data = self._svc.gather_data(
                date_from=date_from,
                date_to=date_to,
                supplier_id=supplier_id,
                material_category=material_category,
            )

            stem = "invoice_report"
            created: list[str] = []

            if self._chk_excel.isChecked():
                self._status_lbl.setText("Writing Excel…")
                p = ExcelExporter().export(data, folder / stem)
                created.append(p.name)

            if self._chk_pdf.isChecked():
                self._status_lbl.setText("Writing PDF…")
                p = PDFReportExporter().export(data, folder / stem)
                created.append(p.name)

            self._status_lbl.setText(f"Done: {', '.join(created)}")
            QMessageBox.information(
                self,
                "Export Complete",
                f"Files saved to:\n{folder}\n\n"
                + "\n".join(f"  • {n}" for n in created),
            )
            self.accept()

        except Exception as exc:
            self._status_lbl.setText(f"Error: {exc}")
            QMessageBox.critical(self, "Export Failed", str(exc))

        finally:
            self._export_btn.setEnabled(True)


# ── helpers ───────────────────────────────────────────────────────────────────

def _divider() -> QFrame:
    line = QFrame()
    line.setFrameShape(QFrame.Shape.HLine)
    line.setStyleSheet("color: #313244;")
    return line
