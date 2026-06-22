# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec file for Smart Invoice Summarizer v0.4.0
# Build:  pyinstaller invoice_summarizer.spec
# Output: dist/invoice-summarizer/
#

import sys
from pathlib import Path

block_cipher = None
SPEC_DIR = Path(SPECPATH)          # invoice_summarizer/

a = Analysis(
    [str(SPEC_DIR / "main.py")],
    pathex=[str(SPEC_DIR)],        # make 'app.*' importable
    binaries=[],
    datas=[],
    hiddenimports=[
        # ── PySide6 ────────────────────────────────────────────────────
        "PySide6.QtCore",
        "PySide6.QtGui",
        "PySide6.QtWidgets",
        "PySide6.QtPrintSupport",
        "PySide6.QtSvg",
        "shiboken6",
        # ── Third-party ────────────────────────────────────────────────
        "openpyxl",
        "openpyxl.styles",
        "openpyxl.styles.fills",
        "openpyxl.styles.borders",
        "openpyxl.styles.fonts",
        "openpyxl.styles.alignment",
        "openpyxl.utils",
        "openpyxl.utils.cell",
        "openpyxl.writer.excel",
        "reportlab",
        "reportlab.platypus",
        "reportlab.platypus.doctemplate",
        "reportlab.platypus.flowables",
        "reportlab.platypus.paragraph",
        "reportlab.platypus.tables",
        "reportlab.lib",
        "reportlab.lib.colors",
        "reportlab.lib.enums",
        "reportlab.lib.pagesizes",
        "reportlab.lib.styles",
        "reportlab.lib.units",
        "reportlab.pdfgen",
        "reportlab.pdfgen.canvas",
        "rapidfuzz",
        "rapidfuzz.fuzz",
        "rapidfuzz.process",
        "rapidfuzz.utils",
        "pandas",
        "pandas.core.arrays.masked",
        "pandas.core.arrays.integer",
        "pandas.core.arrays.string_",
        "fitz",          # PyMuPDF
        "pdfplumber",
        "pdfminer",
        "pdfminer.high_level",
        "pdfminer.layout",
        "pdfminer.pdfpage",
        "pytesseract",
        "PIL",
        "PIL.Image",
        # ── App: migrations (loaded via importlib) ─────────────────────
        "app.database.migrations.v001_initial_schema",
        "app.database.migrations.v002_ocr_fields",
        "app.database.migrations.v003_line_item_lengths",
        "app.database.migrations.v004_material_intelligence",
        "app.database.migrations.v005_extraction_diagnostics",
        # ── App: all modules ───────────────────────────────────────────
        "app.config",
        "app.database.db_manager",
        "app.database.migrations.runner",
        "app.database.models",
        "app.database.repositories",
        "app.database.repositories.aggregation_repo",
        "app.database.repositories.category_repo",
        "app.database.repositories.invoice_repo",
        "app.database.repositories.line_item_repo",
        "app.database.repositories.product_repo",
        "app.database.repositories.review_queue_repo",
        "app.database.repositories.supplier_repo",
        "app.export.base_exporter",
        "app.export.excel_exporter",
        "app.export.export_service",
        "app.export.pdf_exporter",
        "app.processing.aggregator",
        "app.processing.ai_hooks",
        "app.processing.invoice_parser",
        "app.processing.invoice_splitter",
        "app.processing.line_item_extractor",
        "app.processing.material_classifier",
        "app.processing.ocr_engine",
        "app.processing.pdf_extractor",
        "app.processing.pipeline",
        "app.processing.supplier_detector",
        "app.processing.unit_classifier",
        "app.seed.demo_data",
        "app.ui.dialogs.assign_suppliers_dialog",
        "app.ui.dialogs.category_dialog",
        "app.ui.dialogs.export_dialog",
        "app.ui.dialogs.ocr_text_dialog",
        "app.ui.dialogs.supplier_dialog",
        "app.ui.main_window",
        "app.ui.style",
        "app.ui.tabs.categories_tab",
        "app.ui.tabs.dashboard_tab",
        "app.ui.tabs.documents_tab",
        "app.ui.tabs.material_summary_tab",
        "app.ui.tabs.products_tab",
        "app.ui.tabs.review_queue_tab",
        "app.ui.tabs.summary_tab",
        "app.ui.tabs.suppliers_tab",
        "app.ui.widgets.metric_card",
        "app.ui.widgets.sidebar",
        "app.utils.file_manager",
        "app.utils.fuzzy_matcher",
        "app.utils.logger",
        "app.utils.text_cleaner",
    ],
    hookspath=["hooks"],    # local overrides (e.g. no-op cryptography hook)
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter", "_tkinter",
        "matplotlib", "scipy",
        "IPython", "jupyter",
        "test", "unittest",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="invoice-summarizer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,       # UPX can break Qt shared libraries
    console=False,   # no terminal window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="invoice-summarizer",
)
