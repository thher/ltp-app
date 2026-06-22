"""Review Queue tab — Phase 5 implementation."""
from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget


class ReviewQueueTab(QWidget):
    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        label = QLabel("Review Queue\n\nFlagged items requiring manual resolution — Phase 5")
        label.setStyleSheet("color: #a6adc8; font-size: 14px;")
        layout.addWidget(label)
        layout.addStretch()
