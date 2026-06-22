"""OCR engine — pytesseract wrapper with Windows auto-detection and image preprocessing.

Handles full-page OCR and top-crop fallback for payment-slip-only pages.
Automatically detects Tesseract on Windows and selects the best available language.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class OcrWord:
    text: str
    left: int
    top: int
    width: int
    height: int
    conf: float     # 0.0-1.0


@dataclass
class OcrResult:
    text: str = ""
    words: list[OcrWord] = field(default_factory=list)
    page_width: int = 0
    page_height: int = 0
    avg_confidence: float = 0.0
    lang_used: str = ""

    @property
    def success(self) -> bool:
        return bool(self.text.strip())


# ── Tesseract setup (module-level, executed once) ──────────────────────────────

_TESSERACT_CONFIGURED: bool = False
_CACHED_LANG: Optional[str] = None

# UB-Mannheim Windows installer default locations
_WINDOWS_TESSERACT_PATHS: list[str] = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def _configure_tesseract() -> None:
    """Detect Tesseract on Windows and point pytesseract at it.

    On Linux/macOS this is a no-op (assumes tesseract is on PATH).
    Safe to call multiple times — runs setup only once.
    """
    global _TESSERACT_CONFIGURED
    if _TESSERACT_CONFIGURED:
        return
    _TESSERACT_CONFIGURED = True

    if sys.platform != "win32":
        return

    try:
        import pytesseract
    except ImportError:
        return

    # Check if tesseract is already on PATH
    import subprocess
    try:
        subprocess.run(
            ["tesseract", "--version"],
            capture_output=True,
            check=True,
            timeout=5,
        )
        return  # Already accessible — nothing to do
    except Exception:
        pass

    # Search common Windows install locations
    for candidate in _WINDOWS_TESSERACT_PATHS:
        if Path(candidate).is_file():
            pytesseract.pytesseract.tesseract_cmd = candidate
            return

    # Also check %LOCALAPPDATA%\Programs\Tesseract-OCR\ (user-level install)
    import os
    local_app = os.environ.get("LOCALAPPDATA", "")
    if local_app:
        user_path = Path(local_app) / "Programs" / "Tesseract-OCR" / "tesseract.exe"
        if user_path.is_file():
            pytesseract.pytesseract.tesseract_cmd = str(user_path)


def _get_ocr_lang() -> str:
    """Return 'nor+eng' if Norwegian tessdata is installed, else 'eng'.

    Result is cached after the first successful call.
    """
    global _CACHED_LANG
    if _CACHED_LANG is not None:
        return _CACHED_LANG
    try:
        import pytesseract
        langs = pytesseract.get_languages(config="")
        _CACHED_LANG = "nor+eng" if "nor" in langs else "eng"
    except Exception:
        _CACHED_LANG = "eng"
    return _CACHED_LANG


# ── Public helpers used by the pipeline ───────────────────────────────────────


def ocr_is_available() -> bool:
    """Return True if pytesseract and tesseract are both usable."""
    _configure_tesseract()
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


# ── Engine class ──────────────────────────────────────────────────────────────


class OcrEngine:
    """Extract text and word bounding boxes from scanned PDF pages."""

    DPI = 200
    _MIN_CHARS_FULL_PAGE = 50   # below this, try top-crop fallback
    _TOP_CROP_FRACTION = 0.15   # fraction of page height used for payment slips

    def is_available(self) -> bool:
        """Check whether OCR can actually run (tesseract found and working)."""
        return ocr_is_available()

    def get_lang(self) -> str:
        """Return the OCR language string that will be used (e.g. 'nor+eng')."""
        _configure_tesseract()
        return _get_ocr_lang()

    def extract_from_pdf(self, pdf_path: Path) -> list[OcrResult]:
        """Convert each PDF page to an image at DPI=200 and OCR it.

        Returns one OcrResult per page, or empty list if pdf2image or
        pytesseract is unavailable/broken.
        """
        _configure_tesseract()
        try:
            from pdf2image import convert_from_path
        except ImportError:
            return []

        try:
            images = convert_from_path(str(pdf_path), dpi=self.DPI)
        except Exception:
            return []

        lang = _get_ocr_lang()
        return [self._ocr_image(img, lang) for img in images]

    # ── Image-level OCR ───────────────────────────────────────────────

    def _ocr_image(self, image, lang: str = "nor+eng") -> OcrResult:
        try:
            import pytesseract
        except ImportError:
            return OcrResult()

        preprocessed = self._preprocess(image)
        text = pytesseract.image_to_string(preprocessed, lang=lang)

        if len(text.strip()) < self._MIN_CHARS_FULL_PAGE:
            # Payment-slip-only page: invoice content sits in the top strip.
            w, h = image.size
            top_crop = image.crop((0, 0, w, int(h * self._TOP_CROP_FRACTION)))
            top_pre = self._preprocess(top_crop, contrast=2.5)
            top_text = pytesseract.image_to_string(top_pre, lang=lang)
            if len(top_text.strip()) > len(text.strip()):
                text = top_text

        words = self._extract_words(preprocessed, lang=lang)
        avg_conf = sum(w.conf for w in words) / len(words) if words else 0.0

        return OcrResult(
            text=text,
            words=words,
            page_width=image.width,
            page_height=image.height,
            avg_confidence=avg_conf,
            lang_used=lang,
        )

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _preprocess(image, contrast: float = 2.0):
        """Grayscale + contrast enhancement for cleaner tesseract input."""
        from PIL import ImageEnhance
        return ImageEnhance.Contrast(image.convert("L")).enhance(contrast)

    @staticmethod
    def _extract_words(image, lang: str = "nor+eng") -> list[OcrWord]:
        """Run pytesseract in TSV mode to get per-word bounding boxes."""
        try:
            import pytesseract
            data = pytesseract.image_to_data(
                image,
                lang=lang,
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
