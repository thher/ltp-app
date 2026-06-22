"""Invoice header parser — regex field extraction with confidence scoring.

Supports English and Swedish invoice formats.
Fields extracted: supplier name, invoice number, invoice date, due date,
total amount, currency.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional


@dataclass
class FieldResult:
    value: Optional[object] = None
    confidence: float = 0.0
    raw: str = ""


@dataclass
class ParseResult:
    supplier_name: FieldResult = field(default_factory=FieldResult)
    invoice_number: FieldResult = field(default_factory=FieldResult)
    invoice_date: FieldResult = field(default_factory=FieldResult)
    due_date: FieldResult = field(default_factory=FieldResult)
    total_amount: FieldResult = field(default_factory=FieldResult)
    currency: FieldResult = field(default_factory=FieldResult)

    @property
    def overall_confidence(self) -> float:
        fields = [
            self.supplier_name,
            self.invoice_number,
            self.invoice_date,
            self.total_amount,
        ]
        scores = [f.confidence for f in fields if f.confidence > 0]
        return sum(scores) / len(scores) if scores else 0.0

    @property
    def needs_review(self) -> bool:
        return self.overall_confidence < 0.6


# ── Date helpers ───────────────────────────────────────────────────────────────

_MONTH_MAP: dict[str, int] = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "maj": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "okt": 10, "nov": 11, "dec": 12,
    "may": 5, "oct": 10,
}

_DATE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"(\d{4})-(\d{2})-(\d{2})"), "iso"),
    (re.compile(r"(\d{2})[./](\d{2})[./](\d{4})"), "dmy"),
    (
        re.compile(
            r"(\d{1,2})\s+"
            r"(jan|feb|mar|apr|maj|may|jun|jul|aug|sep|okt|oct|nov|dec)\w*"
            r"\s+(\d{4})",
            re.I,
        ),
        "textual",
    ),
]

# ── Invoice number ─────────────────────────────────────────────────────────────

_INV_NUM_PATTERNS: list[re.Pattern] = [
    re.compile(
        r"(?:faktura(?:nummer)?|invoice\s*(?:no\.?|number|#)?)"
        r"[:\s#]*([A-Z0-9][\w\-/]{2,20})",
        re.I,
    ),
    re.compile(r"(?:inv|fakt)[.\-#\s]*([A-Z0-9][\w\-]{2,20})", re.I),
    re.compile(r"#\s*([A-Z0-9][\w\-]{2,20})"),
]

# ── Totals ─────────────────────────────────────────────────────────────────────

_TOTAL_PATTERNS: list[re.Pattern] = [
    re.compile(
        r"(?:totalt?|total\s+amount|att\s+betala|to\s+pay|grand\s+total|summa)"
        r"[:\s]*([0-9][\d\s.,]*)\s*(SEK|EUR|USD|GBP|kr)?",
        re.I,
    ),
    re.compile(
        r"([0-9]{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{2})?)\s*(SEK|EUR|USD|GBP|kr)\b"
    ),
]

# ── Supplier ───────────────────────────────────────────────────────────────────

_FROM_PATTERNS: list[re.Pattern] = [
    re.compile(r"(?:from|från|leverantör|supplier)[:\s]+(.+)", re.I),
    re.compile(
        r"^(.{5,60}(?:\s+(?:AB|Ltd|GmbH|Inc|AS|Oy|BV|SAS|SARL|LLC|Corp)))\s*$",
        re.M | re.I,
    ),
]


class InvoiceParser:
    """Extract structured header data from raw invoice text."""

    def parse(self, text: str, filename: str = "") -> ParseResult:
        result = ParseResult()
        result.invoice_number              = self._extract_invoice_number(text)
        result.invoice_date                = self._extract_date(text, kind="invoice")
        result.due_date                    = self._extract_date(text, kind="due")
        result.total_amount, result.currency = self._extract_amount_currency(text)
        result.supplier_name               = self._extract_supplier(text, filename)
        return result

    # ── Invoice number ─────────────────────────────────────────────────

    def _extract_invoice_number(self, text: str) -> FieldResult:
        for pat in _INV_NUM_PATTERNS:
            m = pat.search(text)
            if m:
                raw = m.group(1).strip()
                # Require at least one digit — real invoice numbers always have them
                if raw and re.search(r"\d", raw):
                    return FieldResult(value=raw, confidence=0.9, raw=raw)
        return FieldResult(confidence=0.0)

    # ── Dates ──────────────────────────────────────────────────────────

    def _extract_date(self, text: str, kind: str) -> FieldResult:
        if kind == "invoice":
            label = r"(?:invoice\s*date|fakturadatum|datum|date)[:\s]*"
        else:
            label = r"(?:due\s*date|förfallodatum|förfaller|due)[:\s]*"

        label_pat = re.compile(label + r"(.{0,40})", re.I)
        m = label_pat.search(text)
        if m:
            chunk = m.group(1)
            d = self._parse_date_string(chunk)
            if d:
                return FieldResult(value=d, confidence=0.85, raw=chunk.strip())

        # Fallback: first matching date in text
        for pat, fmt in _DATE_PATTERNS:
            m = pat.search(text)
            if m:
                d = self._match_to_date(m, fmt)
                if d:
                    return FieldResult(value=d, confidence=0.4, raw=m.group(0))

        return FieldResult(confidence=0.0)

    def _parse_date_string(self, s: str) -> Optional[date]:
        s = s.strip()
        for pat, fmt in _DATE_PATTERNS:
            m = pat.match(s) or pat.search(s)
            if m:
                d = self._match_to_date(m, fmt)
                if d:
                    return d
        return None

    @staticmethod
    def _match_to_date(m: re.Match, fmt: str) -> Optional[date]:
        try:
            if fmt == "iso":
                return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            if fmt == "dmy":
                return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            if fmt == "textual":
                month = _MONTH_MAP.get(m.group(2)[:3].lower())
                if month:
                    return date(int(m.group(3)), month, int(m.group(1)))
        except (ValueError, IndexError):
            pass
        return None

    # ── Amount / Currency ──────────────────────────────────────────────

    def _extract_amount_currency(
        self, text: str
    ) -> tuple[FieldResult, FieldResult]:
        for pat in _TOTAL_PATTERNS:
            m = pat.search(text)
            if m:
                raw_num = m.group(1)
                cur_str = (m.group(2) or "").strip()
                amount = self._parse_number(raw_num)
                if amount is not None:
                    cur = self._normalize_currency(cur_str)
                    cur_conf = 0.8 if cur != "SEK" else 0.6
                    return (
                        FieldResult(value=amount, confidence=0.85, raw=raw_num),
                        FieldResult(value=cur, confidence=cur_conf, raw=cur_str),
                    )
        return (
            FieldResult(confidence=0.0),
            FieldResult(value="SEK", confidence=0.3, raw=""),
        )

    @staticmethod
    def _normalize_currency(raw: str) -> str:
        upper = raw.upper()
        if upper in ("SEK", "EUR", "USD", "GBP"):
            return upper
        if upper in ("KR", ""):
            return "SEK"
        return "SEK"

    @staticmethod
    def _parse_number(s: str) -> Optional[float]:
        s = s.strip().replace("\xa0", "").replace(" ", "")
        # Swedish: 1.234,56  or  1 234,56
        if re.search(r"\d,\d{2}$", s):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
        try:
            return float(s)
        except ValueError:
            return None

    # ── Supplier ───────────────────────────────────────────────────────

    def _extract_supplier(self, text: str, filename: str) -> FieldResult:
        for pat in _FROM_PATTERNS:
            m = pat.search(text)
            if m:
                name = m.group(1).strip().rstrip(".,;")
                if 3 <= len(name) <= 80:
                    return FieldResult(value=name, confidence=0.75, raw=name)

        # First non-blank line that doesn't start with a digit
        for line in text.split("\n"):
            line = line.strip()
            if len(line) >= 4 and not re.match(r"^\d", line):
                return FieldResult(value=line, confidence=0.3, raw=line)

        if filename:
            stem = Path(filename).stem.replace("_", " ").replace("-", " ").title()
            return FieldResult(value=stem, confidence=0.1, raw=stem)

        return FieldResult(confidence=0.0)
