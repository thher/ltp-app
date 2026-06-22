"""Sidebar navigation widget."""
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QButtonGroup,
    QFrame,
    QLabel,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from app.config import config

_NAV = [
    ("◈", "Dashboard"),
    ("◎", "Suppliers"),
    ("◆", "Categories"),
    ("◇", "Products"),
    ("≡", "Summary"),
    ("⚑", "Review Queue"),
]

_SIDEBAR_STYLE = """
QWidget#Sidebar {
    background: #181825;
    border-right: 1px solid #313244;
}
QPushButton#NavButton {
    background: transparent;
    color: #6c7086;
    border: none;
    border-left: 3px solid transparent;
    border-radius: 0;
    padding: 10px 16px;
    text-align: left;
    font-size: 13px;
}
QPushButton#NavButton:hover {
    background: #1e1e2e;
    color: #cdd6f4;
}
QPushButton#NavButton:checked {
    background: #1e1e2e;
    color: #cdd6f4;
    border-left: 3px solid #89b4fa;
    font-weight: bold;
}
"""


class _NavButton(QPushButton):
    def __init__(self, icon: str, label: str) -> None:
        super().__init__(f"  {icon}   {label}")
        self.setObjectName("NavButton")
        self.setCheckable(True)
        self.setFlat(True)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setMinimumHeight(46)
        self.setCursor(Qt.CursorShape.PointingHandCursor)


class Sidebar(QWidget):
    """
    Fixed-width sidebar with exclusive navigation buttons.
    Emits ``page_requested(index)`` when a nav item is clicked.
    """

    page_requested = Signal(int)

    def __init__(self) -> None:
        super().__init__()
        self.setObjectName("Sidebar")
        self.setFixedWidth(220)
        self.setStyleSheet(_SIDEBAR_STYLE)
        self._buttons: list[_NavButton] = []
        self._group = QButtonGroup(self)
        self._group.setExclusive(True)
        self._build()

    # ── Build ─────────────────────────────────────────────────────────

    def _build(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # ── App header ────────────────────────────────────────────────
        header = QWidget()
        header.setFixedHeight(64)
        header.setStyleSheet("background: #11111b; border-bottom: 1px solid #313244;")
        h_layout = QVBoxLayout(header)
        h_layout.setContentsMargins(16, 0, 16, 0)
        h_layout.setSpacing(1)

        title_font = QFont()
        title_font.setPointSize(12)
        title_font.setBold(True)
        name_lbl = QLabel("Invoice")
        name_lbl.setFont(title_font)
        name_lbl.setStyleSheet("color: #cdd6f4; background: transparent;")
        sub_lbl = QLabel("Summarizer")
        sub_lbl.setFont(title_font)
        sub_lbl.setStyleSheet("color: #89b4fa; background: transparent;")
        h_layout.addStretch()
        h_layout.addWidget(name_lbl)
        h_layout.addWidget(sub_lbl)
        h_layout.addStretch()
        layout.addWidget(header)

        # ── Nav section label ─────────────────────────────────────────
        section_lbl = QLabel("  NAVIGATION")
        section_lbl.setStyleSheet(
            "color: #45475a; font-size: 10px; font-weight: bold; "
            "letter-spacing: 1px; padding: 12px 0 4px 0; background: transparent;"
        )
        layout.addWidget(section_lbl)

        # ── Nav buttons ───────────────────────────────────────────────
        for idx, (icon, label) in enumerate(_NAV):
            btn = _NavButton(icon, label)
            self._group.addButton(btn, idx)
            self._buttons.append(btn)
            layout.addWidget(btn)
            btn.clicked.connect(lambda checked, i=idx: self.page_requested.emit(i))

        layout.addStretch()

        # ── Version footer ────────────────────────────────────────────
        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setStyleSheet("color: #313244;")
        layout.addWidget(sep)

        ver_lbl = QLabel(f"  v{config.APP_VERSION}")
        ver_lbl.setStyleSheet(
            "color: #45475a; font-size: 11px; padding: 8px 0; background: transparent;"
        )
        layout.addWidget(ver_lbl)

        # Activate Dashboard by default
        self._buttons[0].setChecked(True)

    # ── Public API ────────────────────────────────────────────────────

    def set_active(self, index: int) -> None:
        if 0 <= index < len(self._buttons):
            self._buttons[index].setChecked(True)
