"""Main application window."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import QMainWindow, QStatusBar, QTabWidget, QWidget

from app.config import config
from app.database.db_manager import DatabaseManager
from app.database.repositories import AggregationRepository
from app.ui.tabs.dashboard_tab import DashboardTab
from app.ui.tabs.documents_tab import DocumentsTab
from app.ui.tabs.products_tab import ProductsTab
from app.ui.tabs.review_queue_tab import ReviewQueueTab
from app.ui.tabs.summary_tab import SummaryTab
from app.ui.tabs.suppliers_tab import SuppliersTab


_TAB_STYLE = """
QMainWindow {
    background: #11111b;
}
QTabWidget::pane {
    border: none;
    background: #11111b;
}
QTabBar::tab {
    background: #181825;
    color: #a6adc8;
    padding: 10px 20px;
    border: none;
    font-size: 13px;
}
QTabBar::tab:selected {
    background: #1e1e2e;
    color: #cdd6f4;
    border-bottom: 2px solid #89b4fa;
    font-weight: bold;
}
QTabBar::tab:hover {
    background: #1e1e2e;
    color: #cdd6f4;
}
QStatusBar {
    background: #181825;
    color: #6c7086;
    font-size: 11px;
}
"""


class MainWindow(QMainWindow):
    def __init__(self, db: DatabaseManager) -> None:
        super().__init__()
        self._db = db
        self._agg_repo = AggregationRepository(db)

        self.setWindowTitle(config.WINDOW_TITLE)
        self.setMinimumSize(config.WINDOW_MIN_WIDTH, config.WINDOW_MIN_HEIGHT)
        self.setStyleSheet(_TAB_STYLE)

        self._build_tabs()
        self._build_status_bar()

    # ── Build ─────────────────────────────────────────────────────────

    def _build_tabs(self) -> None:
        tabs = QTabWidget()
        tabs.setDocumentMode(True)

        font = QFont()
        font.setPointSize(12)
        tabs.setFont(font)

        # Dashboard is index 0 — default landing page
        self._dashboard = DashboardTab(self._agg_repo)
        tabs.addTab(self._dashboard, "Dashboard")
        tabs.addTab(DocumentsTab(), "Documents")
        tabs.addTab(SuppliersTab(), "Suppliers")
        tabs.addTab(ProductsTab(), "Products")
        tabs.addTab(SummaryTab(), "Summary")
        tabs.addTab(ReviewQueueTab(), "Review Queue")

        tabs.setCurrentIndex(0)
        self.setCentralWidget(tabs)

        tabs.currentChanged.connect(self._on_tab_changed)

    def _build_status_bar(self) -> None:
        bar = QStatusBar()
        bar.showMessage(f"{config.APP_NAME}  v{config.APP_VERSION}  —  Ready")
        self.setStatusBar(bar)

    # ── Signals ───────────────────────────────────────────────────────

    def _on_tab_changed(self, index: int) -> None:
        if index == 0:
            self._dashboard.refresh()
