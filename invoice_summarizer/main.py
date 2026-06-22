"""
Smart Invoice Summarizer — entry point.
Run: python main.py
"""
import sys

from PySide6.QtWidgets import QApplication

from app.config import config
from app.database.db_manager import DatabaseManager
from app.database.migrations import MigrationRunner
from app.ui.main_window import MainWindow


def main() -> int:
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
