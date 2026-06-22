"""Tests for PDFExtractor — pdfplumber / pymupdf extraction."""
import pytest

from app.processing.pdf_extractor import ExtractionResult, PDFExtractor
from tests.processing.conftest import PDFPLUMBER_OK, requires_pdfplumber


@pytest.fixture()
def extractor():
    return PDFExtractor()


class TestExtractionResult:
    def test_success_true_with_text(self):
        r = ExtractionResult(text="hello", method="pdfplumber")
        assert r.success is True

    def test_success_false_empty(self):
        r = ExtractionResult(text="", method="pdfplumber")
        assert r.success is False

    def test_success_false_with_error(self):
        r = ExtractionResult(text="hello", method="pdfplumber", error="boom")
        assert r.success is False


@requires_pdfplumber
class TestPDFExtractorWithRealPDFs:
    """These tests use reportlab-generated PDFs via fixtures."""

    def test_extracts_text_english(self, extractor, english_invoice_pdf):
        result = extractor.extract(english_invoice_pdf)
        assert result.success
        assert "INV-2024-0042" in result.text or "Acme" in result.text

    def test_extracts_text_swedish(self, extractor, swedish_invoice_pdf):
        result = extractor.extract(swedish_invoice_pdf)
        assert result.success
        assert "FAKT-2024-0099" in result.text or "Teknik" in result.text

    def test_method_pdfplumber(self, extractor, english_invoice_pdf):
        result = extractor.extract(english_invoice_pdf)
        assert result.method in ("pdfplumber", "pymupdf")

    def test_page_count_positive(self, extractor, english_invoice_pdf):
        result = extractor.extract(english_invoice_pdf)
        assert result.page_count >= 1

    def test_pages_list_length_matches(self, extractor, english_invoice_pdf):
        result = extractor.extract(english_invoice_pdf)
        assert len(result.pages) == result.page_count

    def test_invalid_path_returns_error(self, extractor, tmp_path):
        bad = tmp_path / "nonexistent.pdf"
        result = extractor.extract(bad)
        assert result.success is False
        assert result.error is not None

    def test_corrupted_pdf_falls_back(self, extractor, tmp_path):
        bad = tmp_path / "bad.pdf"
        bad.write_bytes(b"this is not a pdf")
        result = extractor.extract(bad)
        # Should not raise; either fallback succeeds or returns error result
        assert isinstance(result, ExtractionResult)
