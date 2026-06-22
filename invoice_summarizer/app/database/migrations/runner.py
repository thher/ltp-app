from __future__ import annotations

import importlib
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

# Migration versions to apply, in order.
# Add new entries here when creating a new migration module.
_MIGRATION_NAMES = [
    "v001_initial_schema",
    "v002_ocr_fields",
    "v003_line_item_lengths",
]


class MigrationRunner:
    def __init__(self, db: "DatabaseManager") -> None:
        self.db = db

    def run(self) -> None:
        self._ensure_migrations_table()
        for name in _MIGRATION_NAMES:
            if not self._is_applied(name):
                module = importlib.import_module(
                    f"app.database.migrations.{name}"
                )
                module.up(self.db)
                self._mark_applied(name)
                self.db.commit()

    def _ensure_migrations_table(self) -> None:
        self.db.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version    TEXT PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.db.commit()

    def _is_applied(self, version: str) -> bool:
        row = self.db.fetchone(
            "SELECT 1 FROM schema_migrations WHERE version = ?", (version,)
        )
        return row is not None

    def _mark_applied(self, version: str) -> None:
        self.db.execute(
            "INSERT INTO schema_migrations (version) VALUES (?)", (version,)
        )
