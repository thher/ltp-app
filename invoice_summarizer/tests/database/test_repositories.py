"""
Repository CRUD tests.
All operations run against an in-memory SQLite database (see conftest.py).
"""
import pytest

from app.database.models import (
    AggregatedPurchase,
    Category,
    Invoice,
    LineItem,
    Product,
    ProductAlias,
    Supplier,
    SupplierAlias,
)


# ── CategoryRepository ────────────────────────────────────────────────


class TestCategoryRepository:
    def test_save_and_find_by_id(self, category_repo):
        cat = category_repo.save(Category(name="Auto Parts", color="#ff0000"))
        assert cat.id is not None
        found = category_repo.find_by_id(cat.id)
        assert found.name == "Auto Parts"
        assert found.color == "#ff0000"

    def test_find_by_name(self, category_repo):
        category_repo.save(Category(name="Office Supplies"))
        found = category_repo.find_by_name("Office Supplies")
        assert found is not None
        assert found.name == "Office Supplies"

    def test_find_by_name_missing_returns_none(self, category_repo):
        assert category_repo.find_by_name("Nonexistent") is None

    def test_find_all_ordered(self, category_repo):
        category_repo.save(Category(name="Zeta"))
        category_repo.save(Category(name="Alpha"))
        category_repo.save(Category(name="Mu"))
        names = [c.name for c in category_repo.find_all()]
        assert names == sorted(names)

    def test_update(self, category_repo):
        cat = category_repo.save(Category(name="Tools"))
        cat.description = "Hand and power tools"
        cat.color = "#00ff00"
        category_repo.update(cat)
        found = category_repo.find_by_id(cat.id)
        assert found.description == "Hand and power tools"
        assert found.color == "#00ff00"

    def test_delete(self, category_repo):
        cat = category_repo.save(Category(name="Temporary"))
        category_repo.delete(cat.id)
        assert category_repo.find_by_id(cat.id) is None

    def test_count(self, category_repo):
        before = category_repo.count()  # v006 seeds Norwegian categories
        category_repo.save(Category(name="C1"))
        category_repo.save(Category(name="C2"))
        assert category_repo.count() == before + 2

    def test_subcategory_parent_id(self, category_repo):
        parent = category_repo.save(Category(name="Parent"))
        child = category_repo.save(Category(name="Child", parent_id=parent.id))
        found = category_repo.find_by_id(child.id)
        assert found.parent_id == parent.id


# ── SupplierRepository ────────────────────────────────────────────────


class TestSupplierRepository:
    def _make_supplier(self, name: str, cat_id=None) -> Supplier:
        return Supplier(
            canonical_name=name,
            normalized_key=name.lower(),
            category_id=cat_id,
        )

    def test_save_and_find_by_id(self, supplier_repo):
        s = supplier_repo.save(self._make_supplier("Biltema"))
        assert s.id is not None
        found = supplier_repo.find_by_id(s.id)
        assert found.canonical_name == "Biltema"

    def test_find_by_normalized_key(self, supplier_repo):
        supplier_repo.save(self._make_supplier("IKEA"))
        found = supplier_repo.find_by_normalized_key("ikea")
        assert found is not None

    def test_find_by_normalized_key_missing(self, supplier_repo):
        assert supplier_repo.find_by_normalized_key("nobody") is None

    def test_find_all(self, supplier_repo):
        supplier_repo.save(self._make_supplier("Biltema"))
        supplier_repo.save(self._make_supplier("IKEA"))
        assert len(supplier_repo.find_all()) == 2

    def test_find_by_category(self, category_repo, supplier_repo):
        cat = category_repo.save(Category(name="Retail"))
        supplier_repo.save(self._make_supplier("Biltema", cat.id))
        supplier_repo.save(self._make_supplier("IKEA", cat.id))
        supplier_repo.save(self._make_supplier("Unknown"))
        result = supplier_repo.find_by_category(cat.id)
        assert len(result) == 2

    def test_update(self, supplier_repo):
        s = supplier_repo.save(self._make_supplier("Biltema"))
        s.country = "SE"
        s.vat_number = "SE123456789001"
        supplier_repo.update(s)
        found = supplier_repo.find_by_id(s.id)
        assert found.country == "SE"
        assert found.vat_number == "SE123456789001"

    def test_count(self, supplier_repo):
        assert supplier_repo.count() == 0
        supplier_repo.save(self._make_supplier("A"))
        assert supplier_repo.count() == 1

    def test_add_and_find_alias(self, supplier_repo):
        s = supplier_repo.save(self._make_supplier("Biltema"))
        supplier_repo.add_alias(
            SupplierAlias(supplier_id=s.id, alias="BILTEMA AB", source="detected")
        )
        found = supplier_repo.find_by_alias("BILTEMA AB")
        assert found is not None
        assert found.id == s.id

    def test_find_aliases_list(self, supplier_repo):
        s = supplier_repo.save(self._make_supplier("Biltema"))
        supplier_repo.add_alias(SupplierAlias(supplier_id=s.id, alias="alias1"))
        supplier_repo.add_alias(SupplierAlias(supplier_id=s.id, alias="alias2"))
        aliases = supplier_repo.find_aliases(s.id)
        assert len(aliases) == 2

    def test_add_duplicate_alias_ignored(self, supplier_repo):
        s = supplier_repo.save(self._make_supplier("Biltema"))
        supplier_repo.add_alias(SupplierAlias(supplier_id=s.id, alias="BILTEMA AB"))
        supplier_repo.add_alias(SupplierAlias(supplier_id=s.id, alias="BILTEMA AB"))
        aliases = supplier_repo.find_aliases(s.id)
        assert len(aliases) == 1

    def test_merge(self, supplier_repo, invoice_repo):
        src = supplier_repo.save(self._make_supplier("Biltema Sverige"))
        tgt = supplier_repo.save(self._make_supplier("Biltema"))
        inv = Invoice(
            supplier_id=src.id,
            original_path="/tmp/a.pdf",
            copy_path="/tmp/copy_a.pdf",
            file_hash="abc123",
        )
        invoice_repo.save(inv)
        supplier_repo.merge(src.id, tgt.id)
        assert supplier_repo.find_by_id(src.id) is None
        invoices = invoice_repo.find_by_supplier(tgt.id)
        assert len(invoices) == 1


# ── InvoiceRepository ─────────────────────────────────────────────────


class TestInvoiceRepository:
    def _make_invoice(self, hash_: str, supplier_id=None, status="pending") -> Invoice:
        return Invoice(
            supplier_id=supplier_id,
            original_path=f"/originals/{hash_}.pdf",
            copy_path=f"/copies/{hash_}.pdf",
            file_hash=hash_,
            status=status,
        )

    def test_save_and_find_by_id(self, invoice_repo):
        inv = invoice_repo.save(self._make_invoice("h001"))
        assert inv.id is not None
        found = invoice_repo.find_by_id(inv.id)
        assert found.file_hash == "h001"

    def test_find_by_hash(self, invoice_repo):
        invoice_repo.save(self._make_invoice("unique_hash"))
        found = invoice_repo.find_by_hash("unique_hash")
        assert found is not None

    def test_find_by_hash_missing(self, invoice_repo):
        assert invoice_repo.find_by_hash("no_such_hash") is None

    def test_find_by_supplier(self, supplier_repo, invoice_repo):
        s = supplier_repo.save(Supplier(canonical_name="ACME", normalized_key="acme"))
        invoice_repo.save(self._make_invoice("h1", s.id))
        invoice_repo.save(self._make_invoice("h2", s.id))
        invoice_repo.save(self._make_invoice("h3"))
        result = invoice_repo.find_by_supplier(s.id)
        assert len(result) == 2

    def test_find_by_status(self, invoice_repo):
        invoice_repo.save(self._make_invoice("h1", status="processed"))
        invoice_repo.save(self._make_invoice("h2", status="pending"))
        processed = invoice_repo.find_by_status("processed")
        assert len(processed) == 1

    def test_update_status(self, invoice_repo):
        inv = invoice_repo.save(self._make_invoice("h1"))
        invoice_repo.update_status(inv.id, "processed")
        found = invoice_repo.find_by_id(inv.id)
        assert found.status == "processed"

    def test_count(self, invoice_repo):
        assert invoice_repo.count() == 0
        invoice_repo.save(self._make_invoice("x1"))
        assert invoice_repo.count() == 1

    def test_total_spend_only_processed(self, invoice_repo):
        invoice_repo.save(
            Invoice(original_path="/a.pdf", copy_path="/ca.pdf", file_hash="s1",
                    grand_total=100.0, status="processed")
        )
        invoice_repo.save(
            Invoice(original_path="/b.pdf", copy_path="/cb.pdf", file_hash="s2",
                    grand_total=200.0, status="pending")
        )
        assert invoice_repo.total_spend() == 100.0


# ── LineItemRepository ────────────────────────────────────────────────


class TestLineItemRepository:
    def test_save_and_find_by_invoice(self, invoice_repo, line_item_repo):
        inv = invoice_repo.save(
            Invoice(original_path="/x.pdf", copy_path="/cx.pdf", file_hash="li_test")
        )
        item = line_item_repo.save(
            LineItem(invoice_id=inv.id, raw_description="Motor Oil 5W-40",
                     quantity=2.0, unit_price=15.0, line_total=30.0)
        )
        assert item.id is not None
        items = line_item_repo.find_by_invoice(inv.id)
        assert len(items) == 1
        assert items[0].raw_description == "Motor Oil 5W-40"

    def test_save_many(self, invoice_repo, line_item_repo):
        inv = invoice_repo.save(
            Invoice(original_path="/y.pdf", copy_path="/cy.pdf", file_hash="lm_test")
        )
        items = [
            LineItem(invoice_id=inv.id, raw_description=f"Item {i}") for i in range(5)
        ]
        saved = line_item_repo.save_many(items)
        assert all(i.id is not None for i in saved)
        assert line_item_repo.count() == 5

    def test_find_needs_review(self, invoice_repo, line_item_repo):
        inv = invoice_repo.save(
            Invoice(original_path="/z.pdf", copy_path="/cz.pdf", file_hash="nr_test")
        )
        line_item_repo.save(
            LineItem(invoice_id=inv.id, raw_description="OK item", needs_review=False)
        )
        line_item_repo.save(
            LineItem(invoice_id=inv.id, raw_description="Flag me", needs_review=True)
        )
        flagged = line_item_repo.find_needs_review()
        assert len(flagged) == 1
        assert flagged[0].needs_review is True


# ── ProductRepository ─────────────────────────────────────────────────


class TestProductRepository:
    def test_save_and_find(self, product_repo):
        p = product_repo.save(Product(canonical_name="Motor Oil 5W-40", normalized_key="motor oil 5w-40"))
        assert p.id is not None
        found = product_repo.find_by_id(p.id)
        assert found.canonical_name == "Motor Oil 5W-40"

    def test_find_by_normalized_key(self, product_repo):
        product_repo.save(Product(canonical_name="Filter", normalized_key="filter"))
        found = product_repo.find_by_normalized_key("filter")
        assert found is not None

    def test_alias_roundtrip(self, product_repo):
        p = product_repo.save(Product(canonical_name="Drill", normalized_key="drill"))
        product_repo.add_alias(ProductAlias(product_id=p.id, alias="Power Drill"))
        found = product_repo.find_by_alias("Power Drill")
        assert found is not None
        assert found.id == p.id

    def test_count(self, product_repo):
        assert product_repo.count() == 0
        product_repo.save(Product(canonical_name="X", normalized_key="x"))
        assert product_repo.count() == 1


# ── AggregationRepository ─────────────────────────────────────────────


class TestAggregationRepository:
    def test_dashboard_zeros_on_empty_db(self, agg_repo):
        assert agg_repo.total_suppliers() == 0
        assert agg_repo.total_invoices() == 0
        assert agg_repo.total_spend() == 0.0

    def test_total_suppliers_counts_correctly(self, supplier_repo, agg_repo):
        supplier_repo.save(Supplier(canonical_name="A", normalized_key="a"))
        supplier_repo.save(Supplier(canonical_name="B", normalized_key="b"))
        assert agg_repo.total_suppliers() == 2

    def test_total_invoices_counts_all_statuses(self, invoice_repo, agg_repo):
        invoice_repo.save(Invoice(original_path="/1.pdf", copy_path="/c1.pdf", file_hash="k1", status="processed"))
        invoice_repo.save(Invoice(original_path="/2.pdf", copy_path="/c2.pdf", file_hash="k2", status="pending"))
        assert agg_repo.total_invoices() == 2

    def test_total_spend_only_processed(self, invoice_repo, agg_repo):
        invoice_repo.save(Invoice(original_path="/1.pdf", copy_path="/c1.pdf",
                                  file_hash="sp1", grand_total=500.0, status="processed"))
        invoice_repo.save(Invoice(original_path="/2.pdf", copy_path="/c2.pdf",
                                  file_hash="sp2", grand_total=200.0, status="pending"))
        assert agg_repo.total_spend() == 500.0

    def test_top_suppliers_by_spend(self, supplier_repo, invoice_repo, agg_repo):
        s1 = supplier_repo.save(Supplier(canonical_name="BigSpend", normalized_key="bigspend"))
        s2 = supplier_repo.save(Supplier(canonical_name="SmallSpend", normalized_key="smallspend"))
        invoice_repo.save(Invoice(original_path="/a.pdf", copy_path="/ca.pdf",
                                  file_hash="ts1", supplier_id=s1.id,
                                  grand_total=1000.0, status="processed"))
        invoice_repo.save(Invoice(original_path="/b.pdf", copy_path="/cb.pdf",
                                  file_hash="ts2", supplier_id=s2.id,
                                  grand_total=100.0, status="processed"))
        result = agg_repo.top_suppliers_by_spend(10)
        assert result[0]["canonical_name"] == "BigSpend"
        assert result[0]["total_gross"] == 1000.0

    def test_top_suppliers_by_invoice_count(self, supplier_repo, invoice_repo, agg_repo):
        s1 = supplier_repo.save(Supplier(canonical_name="Frequent", normalized_key="frequent"))
        s2 = supplier_repo.save(Supplier(canonical_name="Rare", normalized_key="rare"))
        for i in range(5):
            invoice_repo.save(Invoice(original_path=f"/f{i}.pdf", copy_path=f"/cf{i}.pdf",
                                      file_hash=f"fc{i}", supplier_id=s1.id))
        invoice_repo.save(Invoice(original_path="/r0.pdf", copy_path="/cr0.pdf",
                                  file_hash="rc0", supplier_id=s2.id))
        result = agg_repo.top_suppliers_by_invoice_count(10)
        assert result[0]["canonical_name"] == "Frequent"
        assert result[0]["invoice_count"] == 5

    def test_spend_by_category_empty(self, agg_repo):
        # v006 seeds 16 Norwegian categories; with no invoices all totals are zero
        result = agg_repo.spend_by_category()
        assert all(r["total_gross"] == 0.0 and r["invoice_count"] == 0 for r in result)

    def test_spend_by_category_with_data(self, category_repo, agg_repo):
        category_repo.save(Category(name="Auto Parts"))
        category_repo.save(Category(name="Office"))
        result = agg_repo.spend_by_category()
        names = [r["name"] for r in result]
        assert "Auto Parts" in names
        assert "Office" in names

    def test_upsert_purchase_accumulates(self, supplier_repo, product_repo, agg_repo):
        s = supplier_repo.save(Supplier(canonical_name="S", normalized_key="s"))
        p = product_repo.save(Product(canonical_name="P", normalized_key="p"))
        agg_repo.upsert_purchase(AggregatedPurchase(
            supplier_id=s.id, product_id=p.id,
            total_quantity=2.0, total_gross=30.0, invoice_count=1,
        ))
        agg_repo.upsert_purchase(AggregatedPurchase(
            supplier_id=s.id, product_id=p.id,
            total_quantity=3.0, total_gross=45.0, invoice_count=1,
        ))
        rows = agg_repo.find_by_supplier(s.id)
        assert len(rows) == 1
        assert rows[0].total_quantity == 5.0
        assert rows[0].total_gross == 75.0
        assert rows[0].invoice_count == 2
