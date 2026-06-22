"""PDF text extraction — pdfplumber primary, pymupdf fallback."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class ExtractionResult:
    text: str = ""
    pages: list[str] = field(default_factory=list)
    method: str = ""          # "pdfplumber" | "pymupdf" | "error"
    page_count: int = 0
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return bool(self.text.strip()) and self.error is None


class PDFExtractor:
    """Extract text from PDF files using pdfplumber with pymupdf fallback."""

    def extract(self, path: Path) -> ExtractionResult:
        result = self._try_pdfplumber(path)
        if result.success:
            return result
        return self._try_pymupdf(path)

    # ── pdfplumber ─────────────────────────────────────────────────────

    def _try_pdfplumber(self, path: Path) -> ExtractionResult:
        try:
            import pdfplumber

            pages: list[str] = []
            with pdfplumber.open(str(path)) as pdf:
                for page in pdf.pages:
                    pages.append(page.extract_text() or "")
            full_text = "\n\n".join(pages)
            return ExtractionResult(
                text=full_text,
                pages=pages,
                method="pdfplumber",
                page_count=len(pages),
            )
        except BaseException as exc:
            # BaseException covers pyo3 PanicException from broken C-extension deps
            return ExtractionResult(method="pdfplumber", error=str(exc))

    # ── pymupdf ────────────────────────────────────────────────────────

    def _try_pymupdf(self, path: Path) -> ExtractionResult:
        try:
            import fitz  # PyMuPDF

            pages: list[str] = []
            doc = fitz.open(str(path))
            for page in doc:
                pages.append(page.get_text())
            doc.close()
            full_text = "\n\n".join(pages)
            return ExtractionResult(
                text=full_text,
                pages=pages,
                method="pymupdf",
                page_count=len(pages),
            )
        except BaseException as exc:
            return ExtractionResult(method="error", error=str(exc))
