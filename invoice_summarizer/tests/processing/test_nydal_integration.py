"""Integration tests for NYDAL 9-invoice PDF using cached OCR output.

These tests run only when /tmp/all_pages_ocr.txt exists (produced by a
prior end-to-end OCR run).  They verify the full splitter→parser pipeline
against the known expected values from the 2026_Nydal_Bygg.pdf fixture.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.processing.invoice_splitter import InvoiceSplitter
from app.processing.invoice_parser import InvoiceParser

CACHED_OCR = Path("/tmp/all_pages_ocr.txt")
requires_cached_ocr = pytest.mark.skipif(
    not CACHED_OCR.exists(),
    reason="cached NYDAL OCR not available — run OcrEngine on the PDF first",
)

EXPECTED_TOTALS: dict[str, float] = {
    "13721": 88_729.40,
    "13720": 54_936.83,
    "13843": 249_872.83,
    "13842": 109_463.35,
    "13844": 157_925.63,
    "14080": 144_380.90,
    "14042": 150_594.76,
    "14020": 144_174.81,
    "14022": 172_168.71,
}
EXPECTED_SUPPLIER = "NYDAL BYGGEVARER AS"
EXPECTED_TOTAL_SPEND = 1_272_247.22


def _load_pages() -> list[str]:
    """Parse /tmp/all_pages_ocr.txt into per-page texts (strips markers)."""
    content = CACHED_OCR.read_text(encoding="utf-8")
    pages: list[str] = []
    page_re = re.compile(
        r"=== PAGE \d+ ===\n(.*?)--- END PAGE \d+ ---",
        re.DOTALL,
    )
    for m in page_re.finditer(content):
        pages.append(m.group(1).rstrip("\n"))
    return pages


@requires_cached_ocr
class TestNydalSplitter:
    def test_17_pages_loaded(self):
        pages = _load_pages()
        assert len(pages) == 17

    def test_nine_invoice_groups(self):
        pages = _load_pages()
        groups = InvoiceSplitter().split(pages)
        assert len(groups) == 9

    def test_group_invoice_numbers(self):
        pages = _load_pages()
        groups = InvoiceSplitter().split(pages)
        numbers = [g.invoice_number for g in groups]
        assert numbers == ["13721", "13720", "13843", "13842", "13844",
                           "14080", "14042", "14020", "14022"]

    def test_first_invoice_spans_two_pages(self):
        pages = _load_pages()
        groups = InvoiceSplitter().split(pages)
        assert groups[0].page_indices == [0, 1]

    def test_single_page_invoice_13720(self):
        pages = _load_pages()
        groups = InvoiceSplitter().split(pages)
        assert groups[1].invoice_number == "13720"
        assert groups[1].page_indices == [2]

    def test_continuation_page_invoice_13844(self):
        pages = _load_pages()
        groups = InvoiceSplitter().split(pages)
        inv = next(g for g in groups if g.invoice_number == "13844")
        assert len(inv.page_indices) == 2


@requires_cached_ocr
class TestNydalParser:
    @pytest.fixture(scope="class")
    def parsed(self):
        pages = _load_pages()
        splitter = InvoiceSplitter()
        parser = InvoiceParser()
        groups = splitter.split(pages)
        return {g.invoice_number: parser.parse(g.combined_text) for g in groups}

    def test_supplier_is_nydal(self, parsed):
        for inv_num, pr in parsed.items():
            assert pr.supplier_name.value == EXPECTED_SUPPLIER, (
                f"Invoice {inv_num}: expected supplier {EXPECTED_SUPPLIER!r}, "
                f"got {pr.supplier_name.value!r}"
            )

    @pytest.mark.parametrize("inv_num,expected", EXPECTED_TOTALS.items())
    def test_invoice_total(self, parsed, inv_num, expected):
        pr = parsed[inv_num]
        assert pr.total_amount.value == pytest.approx(expected, rel=1e-3), (
            f"Invoice {inv_num}: expected {expected}, got {pr.total_amount.value}"
        )

    def test_all_invoices_nok_currency(self, parsed):
        for inv_num, pr in parsed.items():
            assert pr.currency.value == "NOK", (
                f"Invoice {inv_num}: expected NOK, got {pr.currency.value}"
            )

    def test_due_date_differs_from_invoice_date(self, parsed):
        for inv_num, pr in parsed.items():
            if pr.invoice_date.value and pr.due_date.value:
                assert pr.due_date.value >= pr.invoice_date.value, (
                    f"Invoice {inv_num}: due {pr.due_date.value} before "
                    f"invoice {pr.invoice_date.value}"
                )

    def test_aggregated_supplier_spend(self, parsed):
        total = sum(
            pr.total_amount.value
            for pr in parsed.values()
            if pr.total_amount.value is not None
        )
        assert total == pytest.approx(EXPECTED_TOTAL_SPEND, rel=1e-3)

    def test_kid_found_for_continuation_pages(self, parsed):
        """Invoices with continuation pages should have KID numbers."""
        # 13844 page 9 has the full payment slip including KID
        assert parsed["13844"].kid_number.value is not None
