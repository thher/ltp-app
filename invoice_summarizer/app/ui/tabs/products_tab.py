"""Products tab — Phase 5 implementation."""
from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget


class ProductsTab(QWidget):
    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        label = QLabel("Products\n\nProduct browser and alias editor — Phase 5")
        label.setStyleSheet("color: #a6adc8; font-size: 14px;")
        layout.addWidget(label)
        layout.addStretch()
