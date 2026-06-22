"""
Shared pytest fixtures.
All DB tests use an in-memory SQLite database — no files written.
"""
import sys
from pathlib import Path

import pytest

# Ensure the invoice_summarizer package root is on sys.path
ROOT = Path(__file__).parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database.db_manager import DatabaseManager
from app.database.migrations import MigrationRunner
from app.database.repositories import (
    AggregationRepository,
    CategoryRepository,
    InvoiceRepository,
    LineItemRepository,
    ProductRepository,
    SupplierRepository,
)


@pytest.fixture
def db() -> DatabaseManager:
    """In-memory database with full schema applied."""
    manager = DatabaseManager(db_path=Path(":memory:"))
    MigrationRunner(manager).run()
    yield manager
    manager.close()


@pytest.fixture
def category_repo(db) -> CategoryRepository:
    return CategoryRepository(db)


@pytest.fixture
def supplier_repo(db) -> SupplierRepository:
    return SupplierRepository(db)


@pytest.fixture
def invoice_repo(db) -> InvoiceRepository:
    return InvoiceRepository(db)


@pytest.fixture
def line_item_repo(db) -> LineItemRepository:
    return LineItemRepository(db)


@pytest.fixture
def product_repo(db) -> ProductRepository:
    return ProductRepository(db)


@pytest.fixture
def agg_repo(db) -> AggregationRepository:
    return AggregationRepository(db)
