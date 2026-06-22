"""OCR engine — pytesseract wrapper with image preprocessing.

Handles full-page OCR and top-crop fallback for payment-slip-only pages
(scanned pages where the main invoice content is a blue-background box
that returns empty text on a standard full-page pass).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class OcrWord:
    text: str
    left: int
    top: int
    width: int
    height: int
    conf: float     # 0.0–1.0


@dataclass
class OcrResult:
    text: str = ""
    words: list[OcrWord] = field(default_factory=list)
    page_width: int = 0
    page_height: int = 0
    avg_confidence: float = 0.0

    @property
    def success(self) -> bool:
        return bool(self.text.strip())


class OcrEngine:
    """Extract text and word bounding boxes from scanned PDF pages."""

    DPI = 200
    _MIN_CHARS_FULL_PAGE = 50   # below this threshold, try top-crop fallback
    _TOP_CROP_FRACTION = 0.15   # fraction of page height to crop for payment slips

    def extract_from_pdf(self, pdf_path: Path) -> list[OcrResult]:
        """Convert each PDF page to an image at DPI=200 and OCR it.

        Returns one OcrResult per page, or empty list if pdf2image/pytesseract
        is unavailable.
        """
        try:
            from pdf2image import convert_from_path
        except ImportError:
            return []

        try:
            images = convert_from_path(str(pdf_path), dpi=self.DPI)
        except Exception:
            return []

        return [self._ocr_image(img) for img in images]

    # ── Image-level OCR ────────────────────────────────────────────────

    def _ocr_image(self, image) -> OcrResult:
        try:
            import pytesseract
        except ImportError:
            return OcrResult()

        preprocessed = self._preprocess(image)
        text = pytesseract.image_to_string(preprocessed, lang="nor+eng")

        if len(text.strip()) < self._MIN_CHARS_FULL_PAGE:
            # Payment-slip-only page: the invoice content lives in the top strip.
            # Blue background boxes produce empty OCR on the full page.
            w, h = image.size
            top_crop = image.crop((0, 0, w, int(h * self._TOP_CROP_FRACTION)))
            top_pre = self._preprocess(top_crop, contrast=2.5)
            top_text = pytesseract.image_to_string(top_pre, lang="nor+eng")
            if len(top_text.strip()) > len(text.strip()):
                text = top_text

        words = self._extract_words(preprocessed)
        avg_conf = sum(w.conf for w in words) / len(words) if words else 0.0

        return OcrResult(
            text=text,
            words=words,
            page_width=image.width,
            page_height=image.height,
            avg_confidence=avg_conf,
        )

    # ── Helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _preprocess(image, contrast: float = 2.0):
        """Grayscale + contrast enhancement for cleaner tesseract input."""
        from PIL import ImageEnhance
        return ImageEnhance.Contrast(image.convert("L")).enhance(contrast)

    @staticmethod
    def _extract_words(image) -> list[OcrWord]:
        """Run pytesseract in TSV mode to get per-word bounding boxes."""
        try:
            import pytesseract
            data = pytesseract.image_to_data(
                image,
                lang="nor+eng",
                output_type=pytesseract.Output.DICT,
            )
            words: list[OcrWord] = []
            for i, token in enumerate(data["text"]):
                token = token.strip()
                if not token:
                    continue
                raw_conf = float(data["conf"][i])
                if raw_conf < 0:
                    continue
                words.append(OcrWord(
                    text=token,
                    left=int(data["left"][i]),
                    top=int(data["top"][i]),
                    width=int(data["width"][i]),
                    height=int(data["height"][i]),
                    conf=raw_conf / 100.0,
                ))
            return words
        except Exception:
            return []
