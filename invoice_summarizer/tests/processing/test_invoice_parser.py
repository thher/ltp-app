"""Tests for InvoiceParser — regex extraction on plain text (no PDFs needed)."""
from datetime import date

import pytest

from app.processing.invoice_parser import InvoiceParser


@pytest.fixture()
def parser():
    return InvoiceParser()


# ── Invoice number ─────────────────────────────────────────────────────────────

class TestInvoiceNumber:
    def test_english_invoice_no(self, parser):
        text = "Invoice No: INV-2024-0042\nSome other text"
        r = parser.parse(text)
        assert r.invoice_number.value == "INV-2024-0042"
        assert r.invoice_number.confidence >= 0.8

    def test_swedish_fakturanummer(self, parser):
        text = "Fakturanummer: FAKT-2024-0099"
        r = parser.parse(text)
        assert r.invoice_number.value == "FAKT-2024-0099"

    def test_invoice_number_not_found(self, parser):
        r = parser.parse("No recognizable invoice number here")
        assert r.invoice_number.confidence == 0.0

    def test_hash_prefix(self, parser):
        text = "Reference # ABC-123"
        r = parser.parse(text)
        assert r.invoice_number.value == "ABC-123"


# ── Dates ──────────────────────────────────────────────────────────────────────

class TestDates:
    def test_iso_invoice_date(self, parser):
        text = "Invoice Date: 2024-03-15"
        r = parser.parse(text)
        assert r.invoice_date.value == date(2024, 3, 15)
        assert r.invoice_date.confidence >= 0.8

    def test_iso_due_date(self, parser):
        text = "Due Date: 2024-04-15"
        r = parser.parse(text)
        assert r.due_date.value == date(2024, 4, 15)

    def test_swedish_fakturadatum(self, parser):
        text = "Fakturadatum: 2024-05-10"
        r = parser.parse(text)
        assert r.invoice_date.value == date(2024, 5, 10)

    def test_dmy_format(self, parser):
        text = "Date: 15/03/2024"
        r = parser.parse(text)
        assert r.invoice_date.value == date(2024, 3, 15)

    def test_date_not_found(self, parser):
        r = parser.parse("No date in this text")
        assert r.invoice_date.confidence == 0.0


# ── Amount / Currency ──────────────────────────────────────────────────────────

class TestAmountCurrency:
    def test_english_total(self, parser):
        text = "Total Amount: 12000.00 GBP"
        r = parser.parse(text)
        assert r.total_amount.value == pytest.approx(12000.0)
        assert r.currency.value == "GBP"

    def test_swedish_total(self, parser):
        text = "Totalt: 45 000,00 SEK"
        r = parser.parse(text)
        assert r.total_amount.value == pytest.approx(45000.0)
        assert r.currency.value == "SEK"

    def test_kr_currency_normalises_to_sek(self, parser):
        text = "Summa: 9 500,00 kr"
        r = parser.parse(text)
        assert r.currency.value == "SEK"

    def test_amount_not_found(self, parser):
        r = parser.parse("No financial data here")
        assert r.total_amount.confidence == 0.0

    def test_default_currency_sek_when_missing(self, parser):
        r = parser.parse("Total: 500")
        assert r.currency.value == "SEK"


# ── Supplier name ──────────────────────────────────────────────────────────────

class TestSupplierName:
    def test_from_label(self, parser):
        text = "From: Acme Corporation\nDate: 2024-01-01"
        r = parser.parse(text)
        assert r.supplier_name.value == "Acme Corporation"

    def test_company_suffix_ab(self, parser):
        text = "Teknik AB\nStorgatan 5\nStockholm"
        r = parser.parse(text)
        assert "Teknik AB" in str(r.supplier_name.value)

    def test_filename_fallback(self, parser):
        r = parser.parse("", filename="acme_invoice.pdf")
        assert r.supplier_name.value is not None
        assert r.supplier_name.confidence < 0.5   # low confidence for fallback

    def test_no_supplier_no_crash(self, parser):
        r = parser.parse("")
        # Should not raise; confidence may be 0 or low


# ── Overall confidence ────────────────────────────────────────────────────────

class TestOverallConfidence:
    def test_full_invoice_high_confidence(self, parser):
        text = (
            "Acme Corp AB\n"
            "Invoice No: INV-001\n"
            "Invoice Date: 2024-01-15\n"
            "Total Amount: 5000.00 SEK\n"
        )
        r = parser.parse(text)
        assert r.overall_confidence >= 0.7

    def test_empty_text_low_confidence(self, parser):
        r = parser.parse("")
        assert r.overall_confidence < 0.5

    def test_needs_review_empty(self, parser):
        r = parser.parse("")
        assert r.needs_review is True

    def test_does_not_need_review_full(self, parser):
        text = (
            "From: Supplier Ltd\n"
            "Invoice No: INV-999\n"
            "Invoice Date: 2024-06-01\n"
            "Total Amount: 10000.00 EUR\n"
        )
        r = parser.parse(text)
        assert r.needs_review is False
