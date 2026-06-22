"""Processing pipeline — orchestrates PDF → DB for a single invoice file."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from app.database.models import Invoice, ReviewQueueItem
from app.database.repositories.invoice_repo import InvoiceRepository
from app.database.repositories.review_queue_repo import ReviewQueueRepository
from app.database.repositories.supplier_repo import SupplierRepository
from app.processing.invoice_parser import InvoiceParser, ParseResult
from app.processing.pdf_extractor import ExtractionResult, PDFExtractor
from app.utils.file_manager import FileManager


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

    @property
    def is_duplicate(self) -> bool:
        return self.status == "duplicate"

    @property
    def ok(self) -> bool:
        return self.status == "ok"


class ProcessingPipeline:
    """Orchestrates file copy → extract → parse → DB persistence."""

    REVIEW_CONFIDENCE_THRESHOLD = 0.6

    def __init__(
        self,
        file_manager: FileManager,
        extractor: PDFExtractor,
        parser: InvoiceParser,
        invoice_repo: InvoiceRepository,
        supplier_repo: SupplierRepository,
        review_repo: ReviewQueueRepository,
    ) -> None:
        self._fm = file_manager
        self._extractor = extractor
        self._parser = parser
        self._inv_repo = invoice_repo
        self._sup_repo = supplier_repo
        self._review_repo = review_repo

    def run(self, pdf_path: Path) -> PipelineResult:
        result = PipelineResult(original_path=pdf_path)
        try:
            result = self._process(pdf_path)
        except BaseException as exc:
            # BaseException also covers pyo3 PanicException from C-ext deps
            result.status = "error"
            result.error = str(exc)
        return result

    def run_batch(self, pdf_paths: list[Path]) -> list[PipelineResult]:
        return [self.run(p) for p in pdf_paths]

    # ── Internal ───────────────────────────────────────────────────────

    def _process(self, pdf_path: Path) -> PipelineResult:
        result = PipelineResult(original_path=pdf_path)

        # 1. Compute hash on original (read-only)
        file_hash = self._fm.compute_hash(pdf_path)

        # 2. Duplicate check
        existing = self._inv_repo.find_by_hash(file_hash)
        if existing:
            result.status = "duplicate"
            result.invoice_id = existing.id
            return result

        # 3. Copy to managed storage — never writes to original
        copy_path = self._fm.copy_for_import(pdf_path)
        result.copy_path = copy_path

        # 4. Extract text from the copy
        extraction = self._extractor.extract(copy_path)
        result.extraction = extraction

        # 5. Parse invoice headers
        parse_result = self._parser.parse(extraction.text, filename=pdf_path.name)
        result.parse_result = parse_result

        # 6. Supplier lookup — exact normalized-key match (fuzzy matching in Phase 4)
        supplier_id: Optional[int] = None
        if parse_result.supplier_name.value:
            norm_key = str(parse_result.supplier_name.value).lower().strip()
            sup = self._sup_repo.find_by_normalized_key(norm_key)
            if sup:
                supplier_id = sup.id

        # 7. Decide invoice status
        if parse_result.overall_confidence >= self.REVIEW_CONFIDENCE_THRESHOLD:
            invoice_status = "processed"
        else:
            invoice_status = "review"

        # 8. Persist invoice
        invoice = Invoice(
            supplier_id=supplier_id,
            invoice_number=parse_result.invoice_number.value,
            invoice_date=parse_result.invoice_date.value,
            due_date=parse_result.due_date.value,
            currency=parse_result.currency.value or "SEK",
            grand_total=parse_result.total_amount.value,
            original_path=str(pdf_path),
            copy_path=str(copy_path),
            file_hash=file_hash,
            status=invoice_status,
            raw_text=(extraction.text[:10000] if extraction.text else None),
        )
        invoice = self._inv_repo.save(invoice)
        result.invoice_id = invoice.id
        result.status = "ok"

        # 9. Review queue items for low-confidence fields
        review_items = self._build_review_items(invoice, parse_result)
        for item in review_items:
            self._review_repo.save(item)
        result.review_items = review_items

        return result

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
