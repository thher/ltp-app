"""Tests for the demo data seed generator and updated aggregation queries."""
import pytest

from app.database.repositories import AggregationRepository, CategoryRepository, SupplierRepository
from app.seed import SeedDataGenerator


class TestSeedDataGenerator:
    def test_generates_all_categories(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        cat_repo = CategoryRepository(db)
        assert cat_repo.count() == 6

    def test_generates_all_suppliers(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        sup_repo = SupplierRepository(db)
        assert sup_repo.count() == 20

    def test_generates_invoices(self, db):
        gen = SeedDataGenerator(db)
        result = gen.generate()
        assert result["invoices"] > 0

    def test_all_invoices_processed(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        rows = db.fetchall("SELECT DISTINCT status FROM invoices")
        statuses = {r["status"] for r in rows}
        assert statuses == {"processed"}

    def test_all_invoices_have_totals(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        rows = db.fetchall("SELECT grand_total FROM invoices WHERE grand_total IS NULL")
        assert len(rows) == 0

    def test_suppliers_have_categories(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        rows = db.fetchall(
            "SELECT COUNT(*) AS n FROM suppliers WHERE category_id IS NOT NULL"
        )
        assert rows[0]["n"] == 20

    def test_idempotent_categories(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        gen.generate()  # second run
        cat_repo = CategoryRepository(db)
        assert cat_repo.count() == 6

    def test_idempotent_suppliers(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        gen.generate()  # second run
        sup_repo = SupplierRepository(db)
        assert sup_repo.count() == 20

    def test_idempotent_invoices(self, db):
        gen = SeedDataGenerator(db)
        r1 = gen.generate()
        r2 = gen.generate()
        assert r2["invoices"] == 0     # nothing new on second run

    def test_clear_removes_demo_invoices(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        count_before = db.fetchscalar("SELECT COUNT(*) FROM invoices")
        gen.clear()
        count_after = db.fetchscalar("SELECT COUNT(*) FROM invoices")
        assert count_before > 0
        assert count_after == 0

    def test_dashboard_metrics_populated(self, db):
        gen = SeedDataGenerator(db)
        gen.generate()
        agg = AggregationRepository(db)
        assert agg.total_suppliers() == 20
        assert agg.total_invoices() > 0
        assert agg.total_spend() > 0
        assert agg.total_categories() == 6


class TestUpdatedAggregationQueries:
    def test_total_categories_zero_on_empty(self, agg_repo):
        assert agg_repo.total_categories() == 0

    def test_total_categories_counts(self, category_repo, agg_repo):
        from app.database.models import Category
        category_repo.save(Category(name="A"))
        category_repo.save(Category(name="B"))
        assert agg_repo.total_categories() == 2

    def test_spend_by_category_live_query(self, db):
        """spend_by_category should aggregate from invoices, not category_aggregations."""
        from app.database.models import Category, Invoice, Supplier
        cat_repo = CategoryRepository(db)
        sup_repo = SupplierRepository(db)
        from app.database.repositories import InvoiceRepository
        inv_repo = InvoiceRepository(db)
        agg_repo = AggregationRepository(db)

        cat = cat_repo.save(Category(name="TestCat", color="#ff0000"))
        sup = sup_repo.save(Supplier(
            canonical_name="TestCo", normalized_key="testco",
            category_id=cat.id
        ))
        inv_repo.save(Invoice(
            supplier_id=sup.id,
            original_path="/t.pdf", copy_path="/ct.pdf", file_hash="tc1",
            grand_total=1000.0, status="processed"
        ))

        rows = agg_repo.spend_by_category()
        test_row = next((r for r in rows if r["name"] == "TestCat"), None)
        assert test_row is not None
        assert test_row["total_gross"] == 1000.0
        assert test_row["invoice_count"] == 1
        assert test_row["supplier_count"] == 1

    def test_supplier_stats_returns_all(self, db):
        from app.database.models import Supplier
        sup_repo = SupplierRepository(db)
        agg_repo = AggregationRepository(db)
        sup_repo.save(Supplier(canonical_name="Alpha", normalized_key="alpha"))
        sup_repo.save(Supplier(canonical_name="Beta",  normalized_key="beta"))
        stats = agg_repo.supplier_stats()
        assert len(stats) == 2

    def test_supplier_stats_includes_invoice_data(self, db):
        from app.database.models import Invoice, Supplier
        sup_repo = SupplierRepository(db)
        from app.database.repositories import InvoiceRepository
        inv_repo = InvoiceRepository(db)
        agg_repo = AggregationRepository(db)

        sup = sup_repo.save(Supplier(canonical_name="Gamma", normalized_key="gamma"))
        inv_repo.save(Invoice(
            supplier_id=sup.id,
            original_path="/g.pdf", copy_path="/cg.pdf", file_hash="gm1",
            grand_total=500.0, status="processed"
        ))
        inv_repo.save(Invoice(
            supplier_id=sup.id,
            original_path="/g2.pdf", copy_path="/cg2.pdf", file_hash="gm2",
            grand_total=300.0, status="processed"
        ))
        stats = agg_repo.supplier_stats()
        row = next(r for r in stats if r["canonical_name"] == "Gamma")
        assert row["invoice_count"] == 2
        assert row["total_spend"] == 800.0

    def test_supplier_stats_uncategorized_label(self, db):
        from app.database.models import Supplier
        sup_repo = SupplierRepository(db)
        agg_repo = AggregationRepository(db)
        sup_repo.save(Supplier(canonical_name="NoCategory", normalized_key="nocat"))
        stats = agg_repo.supplier_stats()
        row = next(r for r in stats if r["canonical_name"] == "NoCategory")
        assert row["category_name"] == "Uncategorized"
