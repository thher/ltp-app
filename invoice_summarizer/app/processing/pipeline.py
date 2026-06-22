"""Processing pipeline — orchestrates PDF → DB for one or more invoices per file."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from app.database.models import Invoice, LineItem, ReviewQueueItem
from app.database.repositories.invoice_repo import InvoiceRepository
from app.database.repositories.line_item_repo import LineItemRepository
from app.database.repositories.review_queue_repo import ReviewQueueRepository
from app.database.repositories.supplier_repo import SupplierRepository
from app.processing.invoice_parser import InvoiceParser, ParseResult
from app.processing.pdf_extractor import ExtractionResult, PDFExtractor
from app.utils.file_manager import FileManager

if TYPE_CHECKING:
    from app.processing.ocr_engine import OcrEngine, OcrResult
    from app.processing.invoice_splitter import InvoiceSplitter, InvoicePageGroup
    from app.processing.line_item_extractor import LineItemExtractor, ExtractedLineItem


# Average characters per page below which we treat the PDF as scanned
_SCANNED_THRESHOLD_CHARS_PER_PAGE = 100


@dataclass
class PipelineResult:
    original_path: Path
    copy_path: Optional[Path] = None
    invoice_id: Optional[int] = None
    parse_result: Optional[ParseResult] = None
    extraction: Optional[ExtractionResult] = None
    status: str = "pending"    # "ok" | "duplicate" | "error"
    error: Optional[str] = None
    review_items: list[ReviewQueueItem] = field(default_factory=list)
    all_results: list["PipelineResult"] = field(default_factory=list)

    @property
    def is_duplicate(self) -> bool:
        return self.status == "duplicate"

    @property
    def ok(self) -> bool:
        return self.status == "ok"


class ProcessingPipeline:
    """Orchestrates file copy → extract → parse → DB persistence.

    Supports both single-invoice digital PDFs and multi-invoice scanned PDFs.
    When OCR dependencies (pdf2image, pytesseract) are available and the
    extracted text is sparse, the pipeline switches to the OCR path and
    creates one Invoice record per detected invoice group.
    """

    REVIEW_CONFIDENCE_THRESHOLD = 0.6

    def __init__(
        self,
        file_manager: FileManager,
        extractor: PDFExtractor,
        parser: InvoiceParser,
        invoice_repo: InvoiceRepository,
        supplier_repo: SupplierRepository,
        review_repo: ReviewQueueRepository,
        line_item_repo: Optional[LineItemRepository] = None,
        ocr_engine: Optional["OcrEngine"] = None,
        splitter: Optional["InvoiceSplitter"] = None,
        line_item_extractor: Optional["LineItemExtractor"] = None,
    ) -> None:
        self._fm               = file_manager
        self._extractor        = extractor
        self._parser           = parser
        self._inv_repo         = invoice_repo
        self._sup_repo         = supplier_repo
        self._review_repo      = review_repo
        self._li_repo          = line_item_repo
        self._ocr              = ocr_engine
        self._splitter         = splitter
        self._li_extractor     = line_item_extractor

    def run(self, pdf_path: Path) -> PipelineResult:
        result = PipelineResult(original_path=pdf_path)
        try:
            result = self._process(pdf_path)
        except BaseException as exc:
            # BaseException also catches pyo3 PanicException from C-ext deps
            result.status = "error"
            result.error = str(exc)
        return result

    def run_batch(self, pdf_paths: list[Path]) -> list[PipelineResult]:
        return [self.run(p) for p in pdf_paths]

    # ── Dispatch ───────────────────────────────────────────────────────

    def _process(self, pdf_path: Path) -> PipelineResult:
        result = PipelineResult(original_path=pdf_path)

        # 1. Hash on original (read-only)
        file_hash = self._fm.compute_hash(pdf_path)

        # 2. File-level duplicate check (covers both single- and multi-invoice PDFs)
        existing = self._inv_repo.find_by_source_hash(file_hash)
        if existing:
            result.status = "duplicate"
            result.invoice_id = existing.id
            return result

        # 3. Copy to managed storage — never writes to original
        copy_path = self._fm.copy_for_import(pdf_path)
        result.copy_path = copy_path

        # 4. Digital text extraction
        extraction = self._extractor.extract(copy_path)
        result.extraction = extraction

        # 5. Decide: scanned PDF (sparse text) → OCR path; else single-invoice path
        chars_per_page = (
            len(extraction.text) / max(extraction.page_count, 1)
            if extraction.page_count
            else len(extraction.text)
        )
        is_scanned = chars_per_page < _SCANNED_THRESHOLD_CHARS_PER_PAGE

        if is_scanned and self._ocr is not None and self._splitter is not None:
            return self._process_ocr_multi(
                pdf_path, copy_path, file_hash, extraction, result
            )

        return self._process_single(pdf_path, copy_path, file_hash, extraction, result)

    # ── Single-invoice digital path ────────────────────────────────────

    def _process_single(
        self,
        pdf_path: Path,
        copy_path: Path,
        file_hash: str,
        extraction: ExtractionResult,
        result: PipelineResult,
    ) -> PipelineResult:
        parse_result = self._parser.parse(extraction.text, filename=pdf_path.name)
        result.parse_result = parse_result

        supplier_id = self._resolve_supplier(parse_result)

        invoice_status = (
            "processed"
            if parse_result.overall_confidence >= self.REVIEW_CONFIDENCE_THRESHOLD
            else "review"
        )

        invoice = Invoice(
            supplier_id=supplier_id,
            invoice_number=parse_result.invoice_number.value,
            invoice_date=parse_result.invoice_date.value,
            due_date=parse_result.due_date.value,
            currency=parse_result.currency.value or "SEK",
            grand_total=parse_result.total_amount.value,
            kid_number=parse_result.kid_number.value,
            original_path=str(pdf_path),
            copy_path=str(copy_path),
            file_hash=file_hash,
            source_pdf_hash=file_hash,
            status=invoice_status,
            raw_text=(extraction.text[:10000] if extraction.text else None),
        )
        invoice = self._inv_repo.save(invoice)
        result.invoice_id = invoice.id
        result.status = "ok"

        review_items = self._build_review_items(invoice, parse_result)
        for item in review_items:
            self._review_repo.save(item)
        result.review_items = review_items

        return result

    # ── OCR multi-invoice path ─────────────────────────────────────────

    def _process_ocr_multi(
        self,
        pdf_path: Path,
        copy_path: Path,
        file_hash: str,
        extraction: ExtractionResult,
        result: PipelineResult,
    ) -> PipelineResult:
        """OCR the copy, split into invoice groups, persist each separately."""
        assert self._ocr is not None
        assert self._splitter is not None

        ocr_pages: list[OcrResult] = self._ocr.extract_from_pdf(copy_path)

        if not ocr_pages:
            # OCR failed silently — fall back to digital single-invoice path
            return self._process_single(
                pdf_path, copy_path, file_hash, extraction, result
            )

        page_texts = [p.text for p in ocr_pages]
        groups: list[InvoicePageGroup] = self._splitter.split(page_texts)

        if not groups:
            # No invoice headers detected — treat as single invoice
            combined_text = "\n\n".join(page_texts)
            fake_extraction = ExtractionResult(
                text=combined_text,
                pages=page_texts,
                method="ocr",
                page_count=len(page_texts),
            )
            return self._process_single(
                pdf_path, copy_path, file_hash, fake_extraction, result
            )

        # Resolve supplier once (from first group) and share across all invoices
        first_parse = self._parser.parse(
            groups[0].combined_text, filename=pdf_path.name
        )
        shared_supplier_id = self._resolve_supplier(first_parse)

        sub_results: list[PipelineResult] = []
        for i, group in enumerate(groups):
            sub = self._process_ocr_group(
                group=group,
                group_index=i,
                pdf_path=pdf_path,
                copy_path=copy_path,
                file_hash=file_hash,
                source_pdf_hash=file_hash,
                supplier_id=shared_supplier_id,
                ocr_pages=ocr_pages,
            )
            sub_results.append(sub)

        # Top-level result summarises the file-level operation
        ok_count = sum(1 for s in sub_results if s.ok)
        result.status = "ok" if ok_count > 0 else "error"
        result.invoice_id = sub_results[0].invoice_id if sub_results else None
        result.all_results = sub_results
        return result

    def _process_ocr_group(
        self,
        group: "InvoicePageGroup",
        group_index: int,
        pdf_path: Path,
        copy_path: Path,
        file_hash: str,
        source_pdf_hash: str,
        supplier_id: Optional[int],
        ocr_pages: list["OcrResult"],
    ) -> PipelineResult:
        sub = PipelineResult(original_path=pdf_path, copy_path=copy_path)

        parse_result = self._parser.parse(
            group.combined_text, filename=pdf_path.name
        )
        sub.parse_result = parse_result

        # Each invoice in the file gets a unique file_hash derived from the
        # source hash so the UNIQUE constraint on file_hash is satisfied.
        derived_hash = (
            file_hash
            if group_index == 0
            else f"{file_hash}::{group.invoice_number}"
        )
        # Copy path: first invoice uses the real copy; subsequent ones append
        # a discriminator so the copy_path column (no longer UNIQUE) is clear.
        group_copy_path = (
            str(copy_path)
            if group_index == 0
            else f"{copy_path}[{group.invoice_number}]"
        )

        invoice_status = (
            "processed"
            if parse_result.overall_confidence >= self.REVIEW_CONFIDENCE_THRESHOLD
            else "review"
        )

        invoice = Invoice(
            supplier_id=supplier_id,
            invoice_number=parse_result.invoice_number.value or group.invoice_number,
            invoice_date=parse_result.invoice_date.value,
            due_date=parse_result.due_date.value,
            currency=parse_result.currency.value or "NOK",
            grand_total=parse_result.total_amount.value,
            kid_number=parse_result.kid_number.value,
            original_path=str(pdf_path),
            copy_path=group_copy_path,
            file_hash=derived_hash,
            source_pdf_hash=source_pdf_hash,
            status=invoice_status,
            raw_text=(group.combined_text[:10000]),
        )
        invoice = self._inv_repo.save(invoice)
        sub.invoice_id = invoice.id
        sub.status = "ok"

        # Extract and persist line items
        if self._li_extractor is not None and self._li_repo is not None:
            group_ocr = [ocr_pages[i] for i in group.page_indices]
            extracted = self._li_extractor.extract_from_ocr(group_ocr)
            for ei in extracted:
                li = LineItem(
                    invoice_id=invoice.id,
                    raw_description=ei.description,
                    quantity=ei.quantity,
                    unit=ei.unit,
                    unit_price=ei.unit_price,
                    line_total=ei.line_total,
                    vat_rate=ei.vat_pct,
                    confidence=ei.confidence,
                    needs_review=ei.needs_review,
                )
                self._li_repo.save(li)

        review_items = self._build_review_items(invoice, parse_result)
        for item in review_items:
            self._review_repo.save(item)
        sub.review_items = review_items

        return sub

    # ── Shared helpers ─────────────────────────────────────────────────

    def _resolve_supplier(self, parse_result: ParseResult) -> Optional[int]:
        if not parse_result.supplier_name.value:
            return None
        norm_key = str(parse_result.supplier_name.value).lower().strip()
        sup = self._sup_repo.find_by_normalized_key(norm_key)
        return sup.id if sup else None

    def _build_review_items(
        self, invoice: Invoice, pr: ParseResult
    ) -> list[ReviewQueueItem]:
        items: list[ReviewQueueItem] = []
        threshold = self.REVIEW_CONFIDENCE_THRESHOLD

        if pr.supplier_name.confidence < threshold:
            items.append(ReviewQueueItem(
                invoice_id=invoice.id,
                issue_type="low_confidence_supplier",
                description=(
                    f"Supplier could not be identified confidently "
                    f"(confidence={pr.supplier_name.confidence:.0%})"
                ),
                suggestion=pr.supplier_name.raw or None,
            ))

        if pr.total_amount.confidence < 0.5:
            items.append(ReviewQueueItem(
                invoice_id=invoice.id,
                issue_type="missing_field",
                description="Total amount could not be extracted",
            ))

        if pr.invoice_date.confidence < 0.5:
            items.append(ReviewQueueItem(
                invoice_id=invoice.id,
                issue_type="missing_field",
                description="Invoice date could not be extracted",
            ))

        return items
