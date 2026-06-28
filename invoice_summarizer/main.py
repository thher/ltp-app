"""
Smart Invoice Summarizer — entry point.
Run: python main.py
"""
import logging
import sys

from PySide6.QtWidgets import QApplication

from app.config import config
from app.database.db_manager import DatabaseManager
from app.database.migrations import MigrationRunner
from app.ui.main_window import MainWindow


def _configure_logging() -> None:
    """Send INFO+ to stdout so import progress is visible in the console."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
    # Suppress verbose third-party noise
    for noisy in ("pdfminer", "PIL", "fitz"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def main() -> int:
    _configure_logging()
    config.ensure_dirs()

    db = DatabaseManager()
    MigrationRunner(db).run()

    app = QApplication(sys.argv)
    app.setApplicationName(config.APP_NAME)
    app.setApplicationVersion(config.APP_VERSION)

    window = MainWindow(db)
    window.show()

    result = app.exec()
    db.close()
    return result


if __name__ == "__main__":
    sys.exit(main())
