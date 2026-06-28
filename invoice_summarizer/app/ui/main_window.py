"""Main application window — sidebar navigation layout."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QStackedWidget,
    QStatusBar,
    QVBoxLayout,
    QWidget,
)

from app.config import config
from app.database.db_manager import DatabaseManager
from app.database.repositories import (
    AggregationRepository,
    CategoryRepository,
    InvoiceRepository,
    LineItemRepository,
    ProductRepository,
    ReviewQueueRepository,
    SupplierRepository,
)
from app.export.export_service import ExportService
from app.processing.invoice_parser import InvoiceParser
from app.processing.invoice_splitter import InvoiceSplitter
from app.processing.line_item_extractor import LineItemExtractor
from app.processing.ocr_engine import OcrEngine
from app.processing.pdf_extractor import PDFExtractor
from app.processing.pipeline import ProcessingPipeline
from app.processing.product_normalizer import ProductNormalizerService
from app.seed import SeedDataGenerator
from app.ui.dialogs.export_dialog import ExportDialog
from app.ui.style import DARK
from app.ui.tabs.categories_tab import CategoriesTab
from app.ui.tabs.dashboard_tab import DashboardTab
from app.ui.tabs.documents_tab import DocumentsTab
from app.ui.tabs.material_summary_tab import MaterialSummaryTab
from app.ui.tabs.products_tab import ProductsTab
from app.ui.tabs.review_queue_tab import ReviewQueueTab
from app.ui.tabs.summary_tab import SummaryTab
from app.ui.tabs.suppliers_tab import SuppliersTab
from app.ui.widgets.sidebar import Sidebar
from app.utils.file_manager import FileManager


class MainWindow(QMainWindow):
    def __init__(self, db: DatabaseManager) -> None:
        super().__init__()
        self._db = db
        self._init_repos()
        self._init_pipeline()
        self._seeder = SeedDataGenerator(db)

        self.setWindowTitle(config.WINDOW_TITLE)
        self.setMinimumSize(config.WINDOW_MIN_WIDTH, config.WINDOW_MIN_HEIGHT)
        self.setStyleSheet(DARK)

        self._build_layout()
        self._build_status_bar()

    # ── Repositories ──────────────────────────────────────────────────

    def _init_repos(self) -> None:
        self._cat_repo      = CategoryRepository(self._db)
        self._sup_repo      = SupplierRepository(self._db)
        self._inv_repo      = InvoiceRepository(self._db)
        self._li_repo       = LineItemRepository(self._db)
        self._prod_repo     = ProductRepository(self._db)
        self._agg_repo      = AggregationRepository(self._db)
        self._review_repo   = ReviewQueueRepository(self._db)
        self._export_svc    = ExportService(self._db, self._agg_repo)

    # ── Processing pipeline ───────────────────────────────────────────

    def _init_pipeline(self) -> None:
        self._file_manager       = FileManager()
        self._extractor          = PDFExtractor()
        self._parser             = InvoiceParser()
        self._ocr_engine         = OcrEngine()
        self._splitter           = InvoiceSplitter()
        self._li_extractor       = LineItemExtractor()
        self._product_normalizer = ProductNormalizerService(self._prod_repo)
        self._pipeline           = ProcessingPipeline(
            file_manager        = self._file_manager,
            extractor           = self._extractor,
            parser              = self._parser,
            invoice_repo        = self._inv_repo,
            supplier_repo       = self._sup_repo,
            review_repo         = self._review_repo,
            line_item_repo      = self._li_repo,
            ocr_engine          = self._ocr_engine,
            splitter            = self._splitter,
            line_item_extractor = self._li_extractor,
            product_normalizer  = self._product_normalizer,
        )

    # ── Layout ────────────────────────────────────────────────────────

    def _build_layout(self) -> None:
        central = QWidget()
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.setCentralWidget(central)

        # Sidebar
        self._sidebar = Sidebar()
        self._sidebar.page_requested.connect(self._navigate_to)
        layout.addWidget(self._sidebar)

        # Screen stack
        self._stack = QStackedWidget()
        layout.addWidget(self._stack)

        # Pages (must match sidebar order)
        self._dashboard        = DashboardTab(self._agg_repo)
        self._suppliers        = SuppliersTab(self._sup_repo, self._cat_repo, self._agg_repo)
        self._categories       = CategoriesTab(self._cat_repo, self._sup_repo)
        self._products         = ProductsTab(self._li_repo)
        self._materials        = MaterialSummaryTab(self._li_repo)
        self._summary          = SummaryTab()
        self._documents        = DocumentsTab(self._pipeline, self._inv_repo)
        self._review_queue     = ReviewQueueTab(
            self._review_repo, self._inv_repo, self._pipeline,
            product_normalizer=self._product_normalizer,
            line_item_repo=self._li_repo,
        )

        for page in (
            self._dashboard, self._suppliers, self._categories,
            self._products, self._materials, self._summary,
            self._documents, self._review_queue,
        ):
            self._stack.addWidget(page)

        # Wire signals
        self._dashboard.seed_requested.connect(self._on_seed_requested)
        self._dashboard.export_requested.connect(self._on_export_requested)
        self._documents.import_completed.connect(self._refresh_all)
        self._documents.import_completed.connect(self._materials.refresh)

        self._stack.setCurrentIndex(0)

    def _build_status_bar(self) -> None:
        bar = QStatusBar()
        bar.showMessage(f"{config.APP_NAME}  v{config.APP_VERSION}  —  Ready")
        self.setStatusBar(bar)

    # ── Navigation ────────────────────────────────────────────────────

    def _navigate_to(self, index: int) -> None:
        self._stack.setCurrentIndex(index)
        self._sidebar.set_active(index)
        page = self._stack.currentWidget()
        if hasattr(page, "refresh"):
            page.refresh()
        self.statusBar().showMessage(f"Ready  —  {self._page_name(index)}")

    @staticmethod
    def _page_name(index: int) -> str:
        names = [
            "Dashboard", "Suppliers", "Categories",
            "Products", "Materials", "Summary", "Documents", "Review Queue",
        ]
        return names[index] if index < len(names) else ""

    # ── Seed ──────────────────────────────────────────────────────────

    def _on_export_requested(self) -> None:
        dlg = ExportDialog(self._export_svc, self._sup_repo, parent=self)
        dlg.exec()

    def _on_seed_requested(self) -> None:
        result = self._seeder.generate()
        self._refresh_all()
        self.statusBar().showMessage(
            f"Demo data loaded — {result['suppliers']} suppliers, "
            f"{result['invoices']} invoices"
        )

    def _refresh_all(self) -> None:
        for i in range(self._stack.count()):
            widget = self._stack.widget(i)
            if hasattr(widget, "refresh"):
                widget.refresh()
