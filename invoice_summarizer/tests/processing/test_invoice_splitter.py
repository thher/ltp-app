"""Tests for InvoiceSplitter — multi-invoice PDF page grouping."""
import pytest

from app.processing.invoice_splitter import InvoiceSplitter, InvoicePageGroup


@pytest.fixture()
def splitter():
    return InvoiceSplitter()


class TestInvoiceSplitter:
    def test_single_invoice_single_page_inline(self, splitter):
        """Format 1: number on same line as label."""
        pages = ["Fakturanummer: 12345\nSome invoice content"]
        groups = splitter.split(pages)
        assert len(groups) == 1
        assert groups[0].invoice_number == "12345"
        assert groups[0].page_indices == [0]

    def test_single_invoice_single_page_tabular(self, splitter):
        """Format 2: number on a separate line (two-column scanner layout)."""
        pages = [
            "Fakturanummer:\n\nFakturadato:\n\nNYDAL BYGGEVARER AS\n\n5227 NESTTUN\n\n13721\n02.02.2026\n"
        ]
        groups = splitter.split(pages)
        assert len(groups) == 1
        assert groups[0].invoice_number == "13721"

    def test_single_invoice_two_pages(self, splitter):
        pages = [
            "Fakturanummer: 12345\nFirst page content",
            "Continuation of invoice content",
        ]
        groups = splitter.split(pages)
        assert len(groups) == 1
        assert groups[0].page_indices == [0, 1]
        assert len(groups[0].page_texts) == 2

    def test_two_invoices_detected(self, splitter):
        pages = [
            "Fakturanummer: 13721\nFirst invoice",
            "Fakturanummer: 13720\nSecond invoice",
        ]
        groups = splitter.split(pages)
        assert len(groups) == 2
        assert groups[0].invoice_number == "13721"
        assert groups[1].invoice_number == "13720"

    def test_nine_invoices_nydal_pattern(self, splitter):
        """Matches the real NYDAL PDF: 17 pages, 9 invoices."""
        pages = [
            "Fakturanummer: 13721\nInvoice page 1",
            "BETAL TIL: KID: 30009000000137214",     # payment-slip-only
            "Fakturanummer: 13720\nAll-in-one",
            "Fakturanummer: 13843\nPage 4",
            "BETAL TIL: KID: 30009000000138436",
            "Fakturanummer: 13842\nPage 6",
            "BETAL TIL: KID: 30009000000138428",
            "Fakturanummer: 13844\nPage 8",
            "Continuation of 13844 + payment slip",
            "Fakturanummer: 14080\nPage 10",
            "Continuation of 14080 + payment slip",
            "Fakturanummer: 14042\nPage 12",
            "BETAL TIL: KID: 30009000000140424",
            "Fakturanummer: 14020\nPage 14",
            "Continuation of 14020 + payment slip",
            "Fakturanummer: 14022\nPage 16",
            "Continuation of 14022 + payment slip",
        ]
        groups = splitter.split(pages)
        assert len(groups) == 9
        assert groups[0].invoice_number == "13721"
        assert groups[0].page_indices == [0, 1]
        assert groups[1].invoice_number == "13720"
        assert groups[1].page_indices == [2]
        assert groups[7].invoice_number == "14020"
        assert groups[7].page_indices == [13, 14]

    def test_empty_input_returns_empty(self, splitter):
        assert splitter.split([]) == []

    def test_no_invoice_headers_returns_empty(self, splitter):
        pages = ["Some random text", "More random text"]
        groups = splitter.split(pages)
        assert groups == []

    def test_combined_text_joins_pages(self, splitter):
        pages = [
            "Fakturanummer: 9901\nFirst",
            "Second",
            "Third",
        ]
        groups = splitter.split(pages)
        assert len(groups) == 1
        combined = groups[0].combined_text
        assert "First" in combined
        assert "Second" in combined
        assert "Third" in combined

    def test_page_indices_zero_based(self, splitter):
        pages = [
            "Preamble",                    # index 0 — no Fakturanummer
            "Fakturanummer: 1001\nInv 1",  # index 1
            "Fakturanummer: 1002\nInv 2",  # index 2
        ]
        groups = splitter.split(pages)
        # Page 0 is discarded (no invoice header)
        assert len(groups) == 2
        assert groups[0].page_indices == [1]
        assert groups[1].page_indices == [2]

    def test_case_insensitive_header(self, splitter):
        pages = ["FAKTURANUMMER: 77777\nContent"]
        groups = splitter.split(pages)
        assert len(groups) == 1
        assert groups[0].invoice_number == "77777"
