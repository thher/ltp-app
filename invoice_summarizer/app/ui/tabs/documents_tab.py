"""Documents tab — Phase 5 implementation."""
from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget


class DocumentsTab(QWidget):
    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        label = QLabel("Documents\n\nInvoice list and import controls — Phase 5")
        label.setStyleSheet("color: #a6adc8; font-size: 14px;")
        layout.addWidget(label)
        layout.addStretch()
