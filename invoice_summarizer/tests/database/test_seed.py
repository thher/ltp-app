"""Aggregation query tests."""
import pytest

from app.database.repositories import AggregationRepository, CategoryRepository, SupplierRepository


class TestAggregationQueries:
    def test_total_categories_zero_invoices_on_empty(self, agg_repo):
        # v006 seeds 16 Norwegian categories; what matters is invoices = 0
        assert agg_repo.total_invoices() == 0

    def test_total_categories_counts(self, category_repo, agg_repo):
        from app.database.models import Category
        before = agg_repo.total_categories()
        category_repo.save(Category(name="A"))
        category_repo.save(Category(name="B"))
        assert agg_repo.total_categories() == before + 2

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

    def test_empty_database_shows_zeros(self, db):
        agg_repo = AggregationRepository(db)
        assert agg_repo.total_suppliers() == 0
        assert agg_repo.total_invoices() == 0
        assert agg_repo.total_spend() == 0
