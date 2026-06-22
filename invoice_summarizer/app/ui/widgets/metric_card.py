"""Reusable KPI metric card widget."""
from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QFrame, QLabel, QSizePolicy, QVBoxLayout


class MetricCard(QFrame):
    """
    A single KPI tile with a title label and a large value.

    Parameters
    ----------
    title   : displayed in small text above the value
    value   : the numeric / text value
    accent  : hex color for the value label
    subtitle: optional small descriptive text below the value
    """

    def __init__(
        self,
        title: str,
        value: str = "0",
        accent: str = "#89b4fa",
        subtitle: str = "",
    ) -> None:
        super().__init__()
        self._accent = accent
        self.setObjectName("MetricCard")
        self.setFrameShape(QFrame.Shape.StyledPanel)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setMinimumHeight(110)
        self.setStyleSheet(f"""
            #MetricCard {{
                background: #1e1e2e;
                border: 1px solid #313244;
                border-radius: 10px;
            }}
            #MetricCard:hover {{
                border: 1px solid {accent};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 14, 18, 14)
        layout.setSpacing(4)

        # Title
        self._title_lbl = QLabel(title)
        self._title_lbl.setStyleSheet(
            "color: #a6adc8; font-size: 11px; text-transform: uppercase; "
            "letter-spacing: 0.8px; font-weight: bold; background: transparent;"
        )
        layout.addWidget(self._title_lbl)

        # Value
        self._value_lbl = QLabel(value)
        font = QFont()
        font.setPointSize(24)
        font.setBold(True)
        self._value_lbl.setFont(font)
        self._value_lbl.setStyleSheet(
            f"color: {accent}; background: transparent;"
        )
        layout.addWidget(self._value_lbl)

        # Subtitle
        self._sub_lbl = QLabel(subtitle)
        self._sub_lbl.setStyleSheet(
            "color: #6c7086; font-size: 11px; background: transparent;"
        )
        self._sub_lbl.setVisible(bool(subtitle))
        layout.addWidget(self._sub_lbl)

    def set_value(self, value: str) -> None:
        self._value_lbl.setText(value)

    def set_subtitle(self, text: str) -> None:
        self._sub_lbl.setText(text)
        self._sub_lbl.setVisible(bool(text))
