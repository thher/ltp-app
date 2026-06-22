"""Tests for SHA256-based duplicate detection in the pipeline."""
from pathlib import Path

import pytest

from app.database.models import Invoice
from app.database.repositories import InvoiceRepository, ReviewQueueRepository, SupplierRepository
from app.processing.invoice_parser import InvoiceParser
from app.processing.pdf_extractor import PDFExtractor
from app.processing.pipeline import ProcessingPipeline
from app.utils.file_manager import FileManager
from tests.processing.conftest import requires_pdfplumber


def _make_pipeline(db, copies_dir: Path) -> ProcessingPipeline:
    return ProcessingPipeline(
        file_manager=FileManager(copies_dir),
        extractor=PDFExtractor(),
        parser=InvoiceParser(),
        invoice_repo=InvoiceRepository(db),
        supplier_repo=SupplierRepository(db),
        review_repo=ReviewQueueRepository(db),
    )


class TestDuplicateDetection:
    def test_first_import_ok(self, db, tmp_path):
        pdf = tmp_path / "inv.pdf"
        pdf.write_bytes(b"%PDF-1.4 minimal")
        pipeline = _make_pipeline(db, tmp_path / "copies")
        result = pipeline.run(pdf)
        assert result.status in ("ok", "error")   # not duplicate

    @requires_pdfplumber
    def test_second_import_same_file_is_duplicate(self, db, tmp_path):
        pdf = tmp_path / "inv.pdf"
        pdf.write_bytes(b"%PDF-1.4 minimal content xyz")
        pipeline = _make_pipeline(db, tmp_path / "copies")
        r1 = pipeline.run(pdf)
        r2 = pipeline.run(pdf)
        assert r2.is_duplicate

    @requires_pdfplumber
    def test_duplicate_returns_existing_invoice_id(self, db, tmp_path):
        pdf = tmp_path / "inv.pdf"
        pdf.write_bytes(b"%PDF-1.4 dupe test content")
        pipeline = _make_pipeline(db, tmp_path / "copies")
        r1 = pipeline.run(pdf)
        r2 = pipeline.run(pdf)
        if r1.ok:
            assert r2.invoice_id == r1.invoice_id

    @requires_pdfplumber
    def test_different_files_not_duplicate(self, db, tmp_path):
        pdf1 = tmp_path / "inv1.pdf"
        pdf2 = tmp_path / "inv2.pdf"
        pdf1.write_bytes(b"%PDF-1.4 first file")
        pdf2.write_bytes(b"%PDF-1.4 second file different")
        pipeline = _make_pipeline(db, tmp_path / "copies")
        r1 = pipeline.run(pdf1)
        r2 = pipeline.run(pdf2)
        assert not r2.is_duplicate

    def test_original_not_modified(self, db, tmp_path):
        pdf = tmp_path / "original.pdf"
        pdf.write_bytes(b"%PDF-1.4 original content")
        original_bytes = pdf.read_bytes()
        pipeline = _make_pipeline(db, tmp_path / "copies")
        pipeline.run(pdf)
        assert pdf.read_bytes() == original_bytes

    def test_original_not_deleted(self, db, tmp_path):
        pdf = tmp_path / "original.pdf"
        pdf.write_bytes(b"%PDF-1.4 original content")
        pipeline = _make_pipeline(db, tmp_path / "copies")
        pipeline.run(pdf)
        assert pdf.exists()

    @requires_pdfplumber
    def test_copy_created_in_managed_dir(self, db, tmp_path):
        pdf = tmp_path / "inv.pdf"
        pdf.write_bytes(b"%PDF-1.4 managed copy test")
        copies_dir = tmp_path / "copies"
        pipeline = _make_pipeline(db, copies_dir)
        r = pipeline.run(pdf)
        if r.ok and r.copy_path:
            assert r.copy_path.is_relative_to(copies_dir)
