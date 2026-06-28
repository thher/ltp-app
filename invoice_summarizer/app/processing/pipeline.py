"""Processing pipeline — orchestrates PDF -> DB for one or more invoices per file."""
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
    from app.processing.product_normalizer import ProductNormalizerService


# Average chars/page below which we treat the PDF as scanned
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
    """Orchestrates file copy -> extract -> parse -> DB persistence.

    Supports both single-invoice digital PDFs and multi-invoice scanned PDFs.
    Writes a _debug.txt file next to every copied PDF recording extraction
    method, OCR availability, language, text length, parser confidence, and
    the first 2000 characters of extracted text.
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
        product_normalizer: Optional["ProductNormalizerService"] = None,
    ) -> None:
        self._fm                 = file_manager
        self._extractor          = extractor
        self._parser             = parser
        self._inv_repo           = invoice_repo
        self._sup_repo           = supplier_repo
        self._review_repo        = review_repo
        self._li_repo            = line_item_repo
        self._ocr                = ocr_engine
        self._splitter           = splitter
        self._li_extractor       = line_item_extractor
        self._product_normalizer = product_normalizer

    # ── Public API ─────────────────────────────────────────────────────

    def run(self, pdf_path: Path) -> PipelineResult:
        result = PipelineResult(original_path=pdf_path)
        try:
            result = self._process(pdf_path)
        except BaseException as exc:
            result.status = "error"
            result.error = str(exc)
        return result

    def run_batch(self, pdf_paths: list[Path]) -> list[PipelineResult]:
        return [self.run(p) for p in pdf_paths]

    def reprocess_invoice(self, invoice: Invoice) -> PipelineResult:
        """Re-run text extraction and parsing on an existing invoice's copy file.

        Updates the invoice record and replaces its review queue items.
        The copy file is never deleted or overwritten.
        """
        result = PipelineResult(original_path=Path(invoice.original_path))
        try:
            # Multi-invoice copies have a discriminator suffix like "/path.pdf[INV-001]"
            copy_path = Path(str(invoice.copy_path).split("[")[0])
            if not copy_path.is_file():
                result.status = "error"
                result.error = f"Copy file not found: {copy_path}"
                return result

            result.copy_path = copy_path
            ocr_available, ocr_lang = self._get_ocr_status()

            extraction = self._extractor.extract(copy_path)
            result.extraction = extraction

            chars_per_page = (
                len(extraction.text) / max(extraction.page_count, 1)
                if extraction.page_count
                else len(extraction.text)
            )
            is_scanned = chars_per_page < _SCANNED_THRESHOLD_CHARS_PER_PAGE

            extraction_method: str
            if is_scanned and self._ocr is not None:
                ocr_pages = self._ocr.extract_from_pdf(copy_path)
                if ocr_pages:
                    combined = "\n\n".join(p.text for p in ocr_pages)
                    extraction = ExtractionResult(
                        text=combined,
                        pages=[p.text for p in ocr_pages],
                        method="ocr",
                        page_count=len(ocr_pages),
                    )
                    extraction_method = "ocr"
                else:
                    extraction_method = "failed" if not extraction.success else "fallback"
            else:
                extraction_method = "pdf_text" if extraction.success else "failed"

            parse_result = self._parser.parse(
                extraction.text, filename=Path(invoice.original_path).name
            )
            result.parse_result = parse_result

            invoice_status = (
                "processed"
                if parse_result.overall_confidence >= self.REVIEW_CONFIDENCE_THRESHOLD
                else "review"
            )

            # Update invoice — only overwrite fields where we found new data
            if parse_result.supplier_name.value:
                new_sup = self._resolve_supplier(parse_result)
                if new_sup:
                    invoice.supplier_id = new_sup
            if parse_result.invoice_number.value:
                invoice.invoice_number = parse_result.invoice_number.value
            if parse_result.invoice_date.value:
                invoice.invoice_date = parse_result.invoice_date.value
            if parse_result.due_date.value:
                invoice.due_date = parse_result.due_date.value
            if parse_result.currency.value:
                invoice.currency = parse_result.currency.value
            if parse_result.total_amount.value is not None:
                invoice.grand_total = parse_result.total_amount.value
            if parse_result.kid_number.value:
                invoice.kid_number = parse_result.kid_number.value

            invoice.status = invoice_status
            invoice.raw_text = extraction.text[:10000] if extraction.text else invoice.raw_text
            invoice.extraction_method = extraction_method
            invoice.ocr_available = ocr_available
            invoice.ocr_lang = ocr_lang
            invoice.ocr_text_length = len(extraction.text) if extraction.text else 0
            invoice.parser_confidence = parse_result.overall_confidence

            self._inv_repo.update(invoice)

            self._write_debug_file(
                copy_path,
                extraction_method=extraction_method,
                ocr_available=ocr_available,
                ocr_lang=ocr_lang,
                raw_text=extraction.text or "",
                parse_result=parse_result,
            )

            # Replace review queue items for this invoice
            self._review_repo.delete_by_invoice(invoice.id)
            review_items = self._build_review_items(invoice, parse_result)
            if not (extraction.text or "").strip():
                review_items.append(ReviewQueueItem(
                    invoice_id=invoice.id,
                    issue_type="parse_error",
                    description=(
                        f"No text could be extracted after reprocessing "
                        f"(method: {extraction_method}, "
                        f"OCR: {'available' if ocr_available else 'unavailable'})"
                    ),
                ))
            for item in review_items:
                self._review_repo.save(item)
            result.review_items = review_items

            result.invoice_id = invoice.id
            result.status = "ok"

        except BaseException as exc:
            result.status = "error"
            result.error = str(exc)
        return result

    # ── Dispatch ───────────────────────────────────────────────────────

    def _process(self, pdf_path: Path) -> PipelineResult:
        result = PipelineResult(original_path=pdf_path)

        # 1. Hash on original (read-only)
        file_hash = self._fm.compute_hash(pdf_path)

        # 2. File-level duplicate check
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

        # 5. OCR status
        ocr_available, ocr_lang = self._get_ocr_status()

        # 6. Decide path
        chars_per_page = (
            len(extraction.text) / max(extraction.page_count, 1)
            if extraction.page_count
            else len(extraction.text)
        )
        is_scanned = chars_per_page < _SCANNED_THRESHOLD_CHARS_PER_PAGE

        if is_scanned and self._ocr is not None and self._splitter is not None:
            return self._process_ocr_multi(
                pdf_path, copy_path, file_hash, extraction, result,
                ocr_available, ocr_lang,
            )

        if not extraction.success:
            extraction_method = "failed"
        elif is_scanned:
            extraction_method = "fallback"  # sparse but no OCR configured
        else:
            extraction_method = "pdf_text"

        return self._process_single(
            pdf_path, copy_path, file_hash, extraction, result,
            extraction_method=extraction_method,
            ocr_available=ocr_available,
            ocr_lang=ocr_lang,
        )

    # ── Single-invoice digital path ────────────────────────────────────

    def _process_single(
        self,
        pdf_path: Path,
        copy_path: Path,
        file_hash: str,
        extraction: ExtractionResult,
        result: PipelineResult,
        extraction_method: str = "pdf_text",
        ocr_available: bool = False,
        ocr_lang: str = "",
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
            currency=parse_result.currency.value or "NOK",
            grand_total=parse_result.total_amount.value,
            kid_number=parse_result.kid_number.value,
            original_path=str(pdf_path),
            copy_path=str(copy_path),
            file_hash=file_hash,
            source_pdf_hash=file_hash,
            status=invoice_status,
            raw_text=(extraction.text[:10000] if extraction.text else None),
            extraction_method=extraction_method,
            ocr_available=ocr_available,
            ocr_lang=ocr_lang,
            ocr_text_length=len(extraction.text) if extraction.text else 0,
            parser_confidence=parse_result.overall_confidence,
        )
        invoice = self._inv_repo.save(invoice)
        result.invoice_id = invoice.id
        result.status = "ok"

        self._write_debug_file(
            copy_path,
            extraction_method=extraction_method,
            ocr_available=ocr_available,
            ocr_lang=ocr_lang,
            raw_text=extraction.text or "",
            parse_result=parse_result,
            error=extraction.error,
        )

        review_items = self._build_review_items(invoice, parse_result)
        if not (extraction.text or "").strip():
            review_items.append(ReviewQueueItem(
                invoice_id=invoice.id,
                issue_type="parse_error",
                description=(
                    f"No text could be extracted from this PDF "
                    f"(method: {extraction_method}, "
                    f"OCR: {'available' if ocr_available else 'unavailable'})"
                ),
            ))
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
        ocr_available: bool,
        ocr_lang: str,
    ) -> PipelineResult:
        assert self._ocr is not None
        assert self._splitter is not None

        ocr_pages: list[OcrResult] = self._ocr.extract_from_pdf(copy_path)

        if not ocr_pages:
            self._write_debug_file(
                copy_path,
                extraction_method="failed",
                ocr_available=ocr_available,
                ocr_lang=ocr_lang,
                raw_text=extraction.text or "",
                parse_result=None,
                error="OCR returned no pages (pdf2image or pytesseract failure)",
            )
            return self._process_single(
                pdf_path, copy_path, file_hash, extraction, result,
                extraction_method="failed",
                ocr_available=ocr_available,
                ocr_lang=ocr_lang,
            )

        page_texts = [p.text for p in ocr_pages]
        combined_ocr_text = "\n\n".join(page_texts)
        groups: list[InvoicePageGroup] = self._splitter.split(page_texts)

        if not groups:
            fake_extraction = ExtractionResult(
                text=combined_ocr_text,
                pages=page_texts,
                method="ocr",
                page_count=len(page_texts),
            )
            self._write_debug_file(
                copy_path,
                extraction_method="ocr",
                ocr_available=ocr_available,
                ocr_lang=ocr_lang,
                raw_text=combined_ocr_text,
                parse_result=None,
                error=None if combined_ocr_text.strip() else "OCR produced empty text on all pages",
            )
            return self._process_single(
                pdf_path, copy_path, file_hash, fake_extraction, result,
                extraction_method="ocr",
                ocr_available=ocr_available,
                ocr_lang=ocr_lang,
            )

        # Write one debug file for the whole PDF before splitting into groups
        self._write_debug_file(
            copy_path,
            extraction_method="ocr",
            ocr_available=ocr_available,
            ocr_lang=ocr_lang,
            raw_text=combined_ocr_text,
            parse_result=None,
        )

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
                ocr_available=ocr_available,
                ocr_lang=ocr_lang,
            )
            sub_results.append(sub)

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
        ocr_available: bool = True,
        ocr_lang: str = "",
    ) -> PipelineResult:
        sub = PipelineResult(original_path=pdf_path, copy_path=copy_path)

        parse_result = self._parser.parse(
            group.combined_text, filename=pdf_path.name
        )
        sub.parse_result = parse_result

        derived_hash = (
            file_hash
            if group_index == 0
            else f"{file_hash}::{group.invoice_number}"
        )
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
            extraction_method="ocr",
            ocr_available=ocr_available,
            ocr_lang=ocr_lang,
            ocr_text_length=len(group.combined_text),
            parser_confidence=parse_result.overall_confidence,
        )
        invoice = self._inv_repo.save(invoice)
        sub.invoice_id = invoice.id
        sub.status = "ok"

        unmatched_count = 0
        if self._li_extractor is not None and self._li_repo is not None:
            group_ocr = [ocr_pages[i] for i in group.page_indices]
            extracted = self._li_extractor.extract_from_ocr(group_ocr)
            for ei in extracted:
                product_id = None
                if self._product_normalizer is not None:
                    product = self._product_normalizer.find_or_create(
                        ei.description, ei.unit or ""
                    )
                    product_id = product.id
                li = LineItem(
                    invoice_id=invoice.id,
                    product_id=product_id,
                    raw_description=ei.description,
                    quantity=ei.quantity,
                    unit=ei.unit,
                    unit_price=ei.unit_price,
                    line_total=ei.line_total,
                    vat_rate=ei.vat_pct,
                    length_per_unit=ei.length_per_unit,
                    total_length=ei.total_length,
                    unit_type=ei.unit_type.value,
                    normalized_quantity=ei.normalized_quantity,
                    material_category=ei.material_category.value,
                    confidence=ei.confidence,
                    needs_review=ei.needs_review,
                )
                self._li_repo.save(li)
                if ei.needs_review:
                    unmatched_count += 1

        review_items = self._build_review_items(invoice, parse_result)
        if unmatched_count > 0:
            review_items.append(ReviewQueueItem(
                invoice_id=invoice.id,
                issue_type="unmatched_product",
                description=(
                    f"{unmatched_count} line item(s) flagged for product review"
                ),
            ))
        if not group.combined_text.strip():
            review_items.append(ReviewQueueItem(
                invoice_id=invoice.id,
                issue_type="parse_error",
                description="OCR produced empty text for this invoice group",
            ))
        for item in review_items:
            self._review_repo.save(item)
        sub.review_items = review_items

        return sub

    # ── Shared helpers ─────────────────────────────────────────────────

    def _get_ocr_status(self) -> tuple[bool, str]:
        """Return (ocr_available, ocr_lang). Safe to call even if OCR is not configured."""
        if self._ocr is None:
            return False, ""
        try:
            avail = self._ocr.is_available()
            lang = self._ocr.get_lang() if avail else ""
            return avail, lang
        except Exception:
            return False, ""

    def _write_debug_file(
        self,
        copy_path: Path,
        extraction_method: str,
        ocr_available: bool,
        ocr_lang: str,
        raw_text: str,
        parse_result: Optional[ParseResult],
        error: Optional[str] = None,
    ) -> None:
        """Write extraction diagnostics alongside the copied PDF.

        File path: {copy_stem}_debug.txt (next to the copy).
        Contains method, OCR status, text length, confidence, first 2000 chars.
        Write failures are silently ignored (non-fatal).
        """
        debug_path = copy_path.parent / (copy_path.stem + "_debug.txt")
        conf_str = (
            f"{parse_result.overall_confidence:.0%}"
            if parse_result is not None
            else "n/a"
        )
        lines = [
            "Smart Invoice Summarizer - Extraction Debug",
            "=" * 45,
            f"File:                {copy_path.name}",
            f"Extraction method:   {extraction_method}",
            f"OCR available:       {'yes' if ocr_available else 'no'}",
            f"OCR language:        {ocr_lang or 'n/a'}",
            f"Text length (chars): {len(raw_text)}",
            f"Parser confidence:   {conf_str}",
            f"Error:               {error or '(none)'}",
            "",
            "--- Raw extracted text (first 2000 characters) ---",
            raw_text[:2000] if raw_text else "(none)",
        ]
        try:
            debug_path.write_text("\n".join(lines), encoding="utf-8")
        except Exception:
            pass

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
