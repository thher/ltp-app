"""Tests for the migration runner and schema creation."""
import sqlite3


class TestMigrationRunner:
    def test_schema_creates_all_tables(self, db):
        tables = {
            row[0]
            for row in db.fetchall(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        expected = {
            "schema_migrations",
            "categories",
            "suppliers",
            "supplier_aliases",
            "invoices",
            "products",
            "product_aliases",
            "line_items",
            "aggregated_purchases",
            "aggregation_sources",
            "category_aggregations",
            "review_queue",
        }
        assert expected.issubset(tables)

    def test_migration_marked_applied(self, db):
        row = db.fetchone(
            "SELECT version FROM schema_migrations WHERE version = ?",
            ("v001_initial_schema",),
        )
        assert row is not None

    def test_idempotent_rerun(self, db):
        from app.database.migrations import MigrationRunner
        # Running again should not raise or duplicate the migration record
        MigrationRunner(db).run()
        count = db.fetchscalar(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?",
            ("v001_initial_schema",),
        )
        assert count == 1

    def test_foreign_keys_enabled(self, db):
        result = db.fetchscalar("PRAGMA foreign_keys")
        assert result == 1

    def test_wal_mode(self, tmp_path):
        """WAL only applies to file-based databases, not :memory:."""
        from app.database.db_manager import DatabaseManager
        from app.database.migrations import MigrationRunner

        file_db = DatabaseManager(db_path=tmp_path / "test.db")
        MigrationRunner(file_db).run()
        mode = file_db.fetchscalar("PRAGMA journal_mode")
        file_db.close()
        assert mode == "wal"
