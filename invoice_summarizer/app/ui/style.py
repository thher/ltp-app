"""Centralized dark theme stylesheet (Catppuccin Mocha palette)."""

COLORS = {
    "base":     "#1e1e2e",
    "mantle":   "#181825",
    "crust":    "#11111b",
    "surface0": "#313244",
    "surface1": "#45475a",
    "surface2": "#585b70",
    "overlay0": "#6c7086",
    "subtext":  "#a6adc8",
    "text":     "#cdd6f4",
    "blue":     "#89b4fa",
    "green":    "#a6e3a1",
    "yellow":   "#f9e2af",
    "peach":    "#fab387",
    "red":      "#f38ba8",
    "mauve":    "#cba6f7",
    "teal":     "#94e2d5",
    "sky":      "#89dceb",
}

CATEGORY_PALETTE = [
    ("#f38ba8", "Rose"),
    ("#fab387", "Peach"),
    ("#f9e2af", "Yellow"),
    ("#a6e3a1", "Green"),
    ("#94e2d5", "Teal"),
    ("#89b4fa", "Blue"),
    ("#cba6f7", "Mauve"),
    ("#eba0ac", "Flamingo"),
    ("#89dceb", "Sky"),
    ("#b4befe", "Lavender"),
]

DARK = f"""
/* ── Base ─────────────────────────────────────────────── */
QMainWindow, QWidget {{
    background-color: {COLORS['base']};
    color: {COLORS['text']};
    font-family: "Segoe UI", "SF Pro Display", Arial, sans-serif;
    font-size: 13px;
}}
QDialog {{
    background-color: {COLORS['base']};
}}

/* ── Scroll ────────────────────────────────────────────── */
QScrollArea {{
    border: none;
    background: transparent;
}}
QScrollBar:vertical {{
    background: {COLORS['mantle']};
    width: 8px;
    border-radius: 4px;
    margin: 0;
}}
QScrollBar::handle:vertical {{
    background: {COLORS['surface1']};
    border-radius: 4px;
    min-height: 24px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}
QScrollBar:horizontal {{
    background: {COLORS['mantle']};
    height: 8px;
    border-radius: 4px;
}}
QScrollBar::handle:horizontal {{
    background: {COLORS['surface1']};
    border-radius: 4px;
    min-width: 24px;
}}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0;
}}

/* ── Buttons ───────────────────────────────────────────── */
QPushButton {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
    border: none;
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 13px;
}}
QPushButton:hover {{
    background: {COLORS['surface1']};
}}
QPushButton:pressed {{
    background: {COLORS['surface2']};
}}
QPushButton:disabled {{
    background: {COLORS['mantle']};
    color: {COLORS['overlay0']};
}}
QPushButton#primary {{
    background: {COLORS['blue']};
    color: {COLORS['crust']};
    font-weight: bold;
}}
QPushButton#primary:hover {{
    background: {COLORS['sky']};
}}
QPushButton#danger {{
    background: {COLORS['red']};
    color: {COLORS['crust']};
    font-weight: bold;
}}
QPushButton#danger:hover {{
    background: #e57185;
}}

/* ── Inputs ────────────────────────────────────────────── */
QLineEdit {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
    border: 1px solid {COLORS['surface1']};
    border-radius: 6px;
    padding: 7px 10px;
    selection-background-color: {COLORS['blue']};
}}
QLineEdit:focus {{
    border: 1px solid {COLORS['blue']};
}}
QLineEdit::placeholder {{
    color: {COLORS['overlay0']};
}}
QComboBox {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
    border: 1px solid {COLORS['surface1']};
    border-radius: 6px;
    padding: 7px 10px;
    min-width: 120px;
}}
QComboBox:focus {{
    border: 1px solid {COLORS['blue']};
}}
QComboBox::drop-down {{
    border: none;
    width: 24px;
}}
QComboBox QAbstractItemView {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
    selection-background-color: {COLORS['surface1']};
    border: 1px solid {COLORS['surface1']};
    outline: none;
}}
QTextEdit {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
    border: 1px solid {COLORS['surface1']};
    border-radius: 6px;
    padding: 6px;
}}
QTextEdit:focus {{
    border: 1px solid {COLORS['blue']};
}}

/* ── Tables ────────────────────────────────────────────── */
QTableWidget {{
    background: {COLORS['mantle']};
    color: {COLORS['text']};
    gridline-color: {COLORS['surface0']};
    border: 1px solid {COLORS['surface0']};
    border-radius: 8px;
    alternate-background-color: {COLORS['base']};
    selection-background-color: {COLORS['surface0']};
    selection-color: {COLORS['text']};
    outline: none;
}}
QTableWidget::item {{
    padding: 6px 10px;
    border: none;
}}
QTableWidget::item:selected {{
    background: {COLORS['surface0']};
}}
QHeaderView::section {{
    background: {COLORS['crust']};
    color: {COLORS['subtext']};
    padding: 8px 10px;
    border: none;
    border-bottom: 1px solid {COLORS['surface0']};
    font-weight: bold;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}}
QHeaderView::section:first {{
    border-top-left-radius: 8px;
}}
QHeaderView::section:last {{
    border-top-right-radius: 8px;
}}

/* ── Lists ─────────────────────────────────────────────── */
QListWidget {{
    background: {COLORS['mantle']};
    color: {COLORS['text']};
    border: 1px solid {COLORS['surface0']};
    border-radius: 8px;
    outline: none;
}}
QListWidget::item {{
    padding: 10px 14px;
    border-radius: 4px;
}}
QListWidget::item:selected {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
}}
QListWidget::item:hover {{
    background: #252535;
}}

/* ── Checkboxes ────────────────────────────────────────── */
QCheckBox {{
    color: {COLORS['text']};
    spacing: 8px;
}}
QCheckBox::indicator {{
    width: 16px;
    height: 16px;
    border: 2px solid {COLORS['surface1']};
    border-radius: 3px;
    background: {COLORS['surface0']};
}}
QCheckBox::indicator:checked {{
    background: {COLORS['blue']};
    border-color: {COLORS['blue']};
}}
QCheckBox::indicator:hover {{
    border-color: {COLORS['blue']};
}}

/* ── Frames / Separators ───────────────────────────────── */
QFrame[frameShape="4"],
QFrame[frameShape="5"] {{
    color: {COLORS['surface0']};
}}

/* ── Status bar ────────────────────────────────────────── */
QStatusBar {{
    background: {COLORS['crust']};
    color: {COLORS['overlay0']};
    font-size: 11px;
    border-top: 1px solid {COLORS['surface0']};
}}

/* ── Splitter ──────────────────────────────────────────── */
QSplitter::handle {{
    background: {COLORS['surface0']};
}}
QSplitter::handle:horizontal {{
    width: 1px;
}}

/* ── Tooltips ──────────────────────────────────────────── */
QToolTip {{
    background: {COLORS['surface0']};
    color: {COLORS['text']};
    border: 1px solid {COLORS['surface1']};
    padding: 4px 8px;
    border-radius: 4px;
}}

/* ── Message boxes ─────────────────────────────────────── */
QMessageBox {{
    background: {COLORS['base']};
}}
QMessageBox QPushButton {{
    min-width: 80px;
}}
"""
