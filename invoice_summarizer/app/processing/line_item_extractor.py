"""Spatial line item extraction from OCR word bounding boxes.

Designed for NYDAL BYGGEVARER AS invoice layout. Column boundaries are
expressed as fractions of page width so they scale with any DPI setting.

Column layout (calibrated at 200 DPI, 1655-px wide A4):
  Description : 0.000 – 0.371  (0 – 615 px)
  Quantity    : 0.371 – 0.474  (615 – 785 px)
  Unit Price  : 0.474 – 0.590  (785 – 977 px)
  Unit        : 0.590 – 0.652  (977 – 1079 px)
  Discount %  : 0.652 – 0.733  (1079 – 1214 px)
  VAT %       : 0.733 – 0.810  (1214 – 1340 px)
  Amount      : 0.810 – 1.000  (1340 – 1655 px)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional, TYPE_CHECKING

from app.processing.unit_classifier import (
    UnitType,
    classify_unit,
    compute_normalized_quantity,
)
from app.processing.material_classifier import MaterialCategory, classify_material

if TYPE_CHECKING:
    from app.processing.ocr_engine import OcrResult, OcrWord


_COL_FRACTIONS: list[tuple[str, float, float]] = [
    ("description", 0.000, 0.371),
    ("quantity",    0.371, 0.474),
    ("unit_price",  0.474, 0.590),
    ("unit",        0.590, 0.652),
    ("discount",    0.652, 0.733),
    ("vat",         0.733, 0.810),
    ("amount",      0.810, 1.000),
]

# Maps lowercase header keywords → canonical column name
_HEADER_KW: dict[str, str] = {
    "beskrivelse": "description",
    "tekst":       "description",
    "antall":      "quantity",
    "enhetspris":  "unit_price",
    "pris":        "unit_price",
    "enhet":       "unit",
    "rabatt":      "discount",
    "mva":         "vat",
    "beløp":       "amount",
    "belop":       "amount",
}

# "22 stk a 4,8 28X120 ROYAL TERRASSEBORD"
# "70 stk a 3,6 meter 48x148 JUST. IMPREGNERT"
# group 1 = piece count, group 2 = length per piece, group 3 = product description
_BUNDLE_RE = re.compile(
    r"^(\d+(?:[.,]\d+)?)\s+stk\s+a\s+(\d+(?:[.,]\d+)?)\s*(?:m(?:eter)?\s+)?(.+)",
    re.I | re.DOTALL,
)

_TABLE_HEADER_WORDS = {"tekst", "antall", "pris", "enh", "rabatt", "mva", "beløp"}

_STOP_PATTERNS = [
    re.compile(r"Følgende\s+bel[øo]p", re.I),
    re.compile(r"^\s*MVA\s*\(", re.M),
    re.compile(r"Totalt\s+bel[øo]p", re.I),
]

_SECTION_RE = re.compile(
    r"^\s*(HUS|ETG|BYGNING|AVDELING|SEKSJON|BLOKK)\s*\d*\s*$", re.I
)


@dataclass
class ExtractedLineItem:
    description: str = ""
    quantity: Optional[float] = None        # piece count
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    discount_pct: Optional[float] = None
    vat_pct: Optional[float] = None
    line_total: Optional[float] = None
    length_per_unit: Optional[float] = None  # metres per piece (e.g. 4.8)
    total_length: Optional[float] = None     # quantity × length_per_unit
    unit_type: UnitType = field(default=UnitType.UNKNOWN)
    normalized_quantity: Optional[float] = None
    material_category: MaterialCategory = field(default=MaterialCategory.OTHER)
    section: str = ""
    confidence: float = 1.0
    needs_review: bool = False


class LineItemExtractor:
    """Extract line items from OCR results using spatial word positions."""

    def extract(self, text: str) -> list[dict]:
        """Stub for text-only extraction — full implementation in extract_from_ocr."""
        return []

    def extract_from_ocr(
        self, ocr_pages: list["OcrResult"]
    ) -> list[ExtractedLineItem]:
        """Extract all line items from a list of per-page OCR results."""
        items: list[ExtractedLineItem] = []
        current_section = ""

        for page in ocr_pages:
            if not page.words:
                continue
            page_items, current_section = self._extract_page(page, current_section)
            items.extend(page_items)

        return items

    # ── Per-page extraction ────────────────────────────────────────────

    def _extract_page(
        self, page: "OcrResult", section: str
    ) -> tuple[list[ExtractedLineItem], str]:
        if page.page_width == 0:
            return [], section

        rows = self._group_words_into_rows(page.words)

        # Try auto-detecting column bounds from header row; fall back to hardcoded fractions
        auto_bounds = self._auto_detect_col_bounds(rows, page.page_width)
        col_bounds  = auto_bounds if auto_bounds else self._compute_col_bounds(page.page_width)

        items: list[ExtractedLineItem] = []
        in_table = False
        pending_desc = ""

        for row_words in rows:
            row_text = " ".join(w.text for w in row_words)

            # Stop extraction when entering the VAT summary / payment-slip area
            if any(p.search(row_text) for p in _STOP_PATTERNS):
                break

            # Table header row detection (≥2 column header keywords present)
            if not in_table:
                row_lower = row_text.lower()
                if sum(1 for kw in _TABLE_HEADER_WORDS if kw in row_lower) >= 2:
                    in_table = True
                    pending_desc = ""
                continue

            cols = self._assign_to_columns(row_words, col_bounds)
            desc = cols.get("description", "").strip()
            amt  = cols.get("amount", "").strip()
            qty  = cols.get("quantity", "").strip()

            # Description-only row: either a section header or multi-line continuation
            if desc and not amt and not qty:
                if _SECTION_RE.match(desc):
                    section = desc.strip()
                    pending_desc = ""
                elif pending_desc:
                    pending_desc += " " + desc
                else:
                    pending_desc = desc
                continue

            if not amt and not qty:
                continue

            full_desc = (pending_desc + " " + desc).strip() if pending_desc else desc
            pending_desc = ""

            item = self._build_item(cols, full_desc or "—", section)
            if item is not None:
                items.append(item)

        return items, section

    # ── Spatial helpers ────────────────────────────────────────────────

    @staticmethod
    def _auto_detect_col_bounds(
        rows: "list[list[OcrWord]]", page_width: int
    ) -> "dict[str, tuple[int, int]] | None":
        """Scan rows for a table header and derive column boundaries from word positions.

        Returns None when no header row with ≥ 4 recognisable column keywords is found,
        so the caller can fall back to the hardcoded fractions.
        """
        for row_words in rows:
            row_lower = " ".join(w.text for w in row_words).lower()
            if sum(1 for kw in _HEADER_KW if kw in row_lower) < 3:
                continue

            # Header row found — map each keyword to the centre-X of its word
            centers: dict[str, int] = {}
            for word in row_words:
                wl = word.text.lower().rstrip('%').rstrip('.')
                col_name = _HEADER_KW.get(wl)
                if col_name and col_name not in centers:
                    centers[col_name] = word.left + word.width // 2

            if len(centers) < 4:
                continue

            # Build bounds by splitting at midpoints between adjacent column centres
            sorted_cols = sorted(centers.items(), key=lambda x: x[1])
            bounds: dict[str, tuple[int, int]] = {}
            for j, (name, cx) in enumerate(sorted_cols):
                lo = 0 if j == 0 else (sorted_cols[j - 1][1] + cx) // 2
                hi = (page_width
                      if j == len(sorted_cols) - 1
                      else (cx + sorted_cols[j + 1][1]) // 2)
                bounds[name] = (lo, hi)

            # Anchor edge columns to page boundaries
            if "description" in bounds:
                bounds["description"] = (0, bounds["description"][1])
            if "amount" in bounds:
                bounds["amount"] = (bounds["amount"][0], page_width)

            return bounds

        return None

    @staticmethod
    def _compute_col_bounds(page_width: int) -> dict[str, tuple[int, int]]:
        return {
            name: (int(lo * page_width), int(hi * page_width))
            for name, lo, hi in _COL_FRACTIONS
        }

    @staticmethod
    def _group_words_into_rows(
        words: list["OcrWord"], tolerance: int = 12
    ) -> list[list["OcrWord"]]:
        """Group words whose vertical centres fall within *tolerance* px."""
        if not words:
            return []
        sorted_w = sorted(words, key=lambda w: w.top + w.height // 2)
        rows: list[list["OcrWord"]] = []
        current: list["OcrWord"] = [sorted_w[0]]
        cy = sorted_w[0].top + sorted_w[0].height // 2

        for w in sorted_w[1:]:
            wy = w.top + w.height // 2
            if abs(wy - cy) <= tolerance:
                current.append(w)
            else:
                rows.append(sorted(current, key=lambda x: x.left))
                current = [w]
                cy = wy

        if current:
            rows.append(sorted(current, key=lambda x: x.left))
        return rows

    @staticmethod
    def _assign_to_columns(
        row_words: list["OcrWord"],
        col_bounds: dict[str, tuple[int, int]],
    ) -> dict[str, str]:
        """Assign each word to a column based on its centre X; join multiple words."""
        buckets: dict[str, list[str]] = {name: [] for name in col_bounds}
        for word in row_words:
            cx = word.left + word.width // 2
            for name, (lo, hi) in col_bounds.items():
                if lo <= cx < hi:
                    buckets[name].append(word.text)
                    break
        return {name: " ".join(tokens) for name, tokens in buckets.items()}

    # ── Numeric parsing ────────────────────────────────────────────────

    @staticmethod
    def _parse_number(s: str) -> Optional[float]:
        """Parse Norwegian-format numbers (space thousands, comma decimal).

        Handles 1- or 2-decimal comma notation: "4,8" → 4.8, "1 234,56" → 1234.56.
        """
        s = s.strip().replace("\xa0", "").replace(" ", "")
        if not s:
            return None
        # Comma followed by 1 or 2 digits at end → decimal separator
        if re.search(r"\d,[0-9]{1,2}$", s):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
        try:
            return float(s)
        except ValueError:
            return None

    def _build_item(
        self,
        cols: dict[str, str],
        description: str,
        section: str,
    ) -> Optional[ExtractedLineItem]:
        unit_price = self._parse_number(cols.get("unit_price", ""))
        discount   = self._parse_number(cols.get("discount", ""))
        vat        = self._parse_number(cols.get("vat", ""))
        amount     = self._parse_number(cols.get("amount", ""))
        unit_str   = cols.get("unit", "").strip() or None

        if amount is None and unit_price is None:
            return None

        # Detect "22 stk a 4,8 <product name>" bundle prefix
        length_per_unit: Optional[float] = None
        total_length: Optional[float] = None
        bm = _BUNDLE_RE.match(description)
        if bm:
            piece_count   = self._parse_number(bm.group(1))
            length_sample = self._parse_number(bm.group(2))
            # Sanity: board lengths realistically < 30 m
            if piece_count and length_sample and length_sample < 30:
                description     = bm.group(3).strip()
                length_per_unit = length_sample
                qty             = piece_count
                total_length    = piece_count * length_sample
            else:
                qty = self._parse_number(cols.get("quantity", ""))
        else:
            qty = self._parse_number(cols.get("quantity", ""))

        missing = sum(1 for v in (qty, unit_price, amount) if v is None)
        confidence = max(0.0, 1.0 - missing * 0.25)

        unit_type    = classify_unit(unit_str)
        norm_qty     = compute_normalized_quantity(qty, unit_type, total_length)
        mat_category = classify_material(description)

        return ExtractedLineItem(
            description=description,
            quantity=qty,
            unit=unit_str,
            unit_price=unit_price,
            discount_pct=discount,
            vat_pct=vat,
            line_total=amount,
            length_per_unit=length_per_unit,
            total_length=total_length,
            unit_type=unit_type,
            normalized_quantity=norm_qty,
            material_category=mat_category,
            section=section,
            confidence=confidence,
            needs_review=confidence < 0.6,
        )
