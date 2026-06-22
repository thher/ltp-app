"""Invoice header parser — regex field extraction with confidence scoring.

Supports English, Swedish, and Norwegian invoice formats.
Fields extracted: supplier name, invoice number, invoice date, due date,
total amount, currency, KID (Norwegian payment reference).
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
    kid_number: FieldResult = field(default_factory=FieldResult)

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
    def is_norwegian(self) -> bool:
        return (
            self.kid_number.value is not None
            or self.currency.value == "NOK"
        )

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

# Norwegian "Følgende beløp skal betales innen frist NOK 172 168,71"
_FOLGENDEBETALES_RE = re.compile(
    r"Følgende\s+bel[øo]p\s+skal\s+betales[^\n]*(NOK|SEK|EUR|USD|GBP)\s+([0-9][0-9 .,]+)",
    re.I,
)

# Standalone currency-prefix line: "NOK 54 936,83"
_STANDALONE_CURRENCY_AMOUNT_RE = re.compile(
    r"^(NOK|SEK|EUR|USD|GBP)\s+([0-9][0-9 .,]+)\s*$",
    re.I | re.MULTILINE,
)

# Norwegian total anchor: amount immediately before "Fordringen er pantsatt"
_FORDRINGEN_RE = re.compile(
    r"([0-9][0-9 .,]+)\n\nFordringen\s+er\s+pantsatt",
    re.I,
)

_TOTAL_PATTERNS: list[re.Pattern] = [
    # Norwegian "Totalt beløp: [NOK] amount [NOK]"
    # group 1 = leading currency (optional), group 2 = amount, group 3 = trailing currency
    re.compile(
        r"(?:totalt?\s*bel[øo]p)"
        r"[:\s]*(NOK|SEK|EUR|USD|GBP)?\s*([0-9][0-9 .,]*)[^\S\n]*(NOK|SEK|EUR|USD|GBP|kr)?",
        re.I,
    ),
    # General total labels — group 1 = amount, group 2 = currency
    re.compile(
        r"(?:totalt?|total\s+amount|att\s+betala|to\s+pay|grand\s+total|summa)"
        r"[:\s]*([0-9][0-9 .,]*)[^\S\n]*(SEK|EUR|USD|GBP|kr)?",
        re.I,
    ),
    # "amount NOK" on the same line (no newlines between amount and currency)
    re.compile(
        r"([0-9]{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{2})?)[^\S\n]*(NOK|SEK|EUR|USD|GBP|kr)\b"
    ),
]

# ── KID (Norwegian payment reference) ─────────────────────────────────────────

_KID_RE: re.Pattern = re.compile(r"KID[:\s]*(\d{10,25})", re.I)
# Standalone 15–25 digit line (KID in NYDAL payment slip format)
_KID_LINE_RE: re.Pattern = re.compile(r"^(\d{15,25})\s*$", re.MULTILINE)

# ── Supplier ───────────────────────────────────────────────────────────────────

_FROM_PATTERNS: list[re.Pattern] = [
    # Norwegian two-column: "Leverandør\nCOMPANY NAME"
    re.compile(r"Leverand[øo]r[^\n]*\n\n?(.{3,80})", re.I),
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
        result.kid_number                  = self._extract_kid(text)
        return result

    # ── Invoice number ─────────────────────────────────────────────────

    def _extract_invoice_number(self, text: str) -> FieldResult:
        for pat in _INV_NUM_PATTERNS:
            m = pat.search(text)
            if m:
                raw = m.group(1).strip()
                if raw and re.search(r"\d", raw):
                    return FieldResult(value=raw, confidence=0.9, raw=raw)
        return FieldResult(confidence=0.0)

    # ── Dates ──────────────────────────────────────────────────────────

    def _extract_date(self, text: str, kind: str) -> FieldResult:
        if kind == "invoice":
            label = r"(?:invoice\s*date|fakturadatum|fakturadato|datum|date)[:\s]*"
        else:
            label = r"(?:due\s*date|förfallodatum|förfaller|betalingsfrist|forfallsdato|due)[:\s]*"

        label_pat = re.compile(label + r"(.{0,40})", re.I)
        m = label_pat.search(text)
        if m:
            chunk = m.group(1)
            d = self._parse_date_string(chunk)
            if d:
                return FieldResult(value=d, confidence=0.85, raw=chunk.strip())

        # Collect all unique dates in text order
        seen: list[date] = []
        seen_raw: list[str] = []
        for pat, fmt in _DATE_PATTERNS:
            for dm in pat.finditer(text):
                d = self._match_to_date(dm, fmt)
                if d and d not in seen:
                    seen.append(d)
                    seen_raw.append(dm.group(0))

        if not seen:
            return FieldResult(confidence=0.0)

        # For due-date fallback use the second unique date (two-column OCR layout
        # serialises invoice date before due date as standalone lines)
        idx = 1 if (kind == "due" and len(seen) > 1) else 0
        return FieldResult(value=seen[idx], confidence=0.4, raw=seen_raw[idx])

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
        # 1. "Følgende beløp skal betales innen frist NOK 172 168,71"
        m = _FOLGENDEBETALES_RE.search(text)
        if m:
            amount = self._parse_number(m.group(2))
            if amount is not None:
                cur = self._normalize_currency(m.group(1))
                return (
                    FieldResult(value=amount, confidence=0.9, raw=m.group(2)),
                    FieldResult(value=cur, confidence=0.9, raw=m.group(1)),
                )

        # 2. "Totalt beløp: [NOK] amount [NOK]"
        #    group 1 = leading currency, group 2 = amount, group 3 = trailing currency
        m = _TOTAL_PATTERNS[0].search(text)
        if m:
            raw_num = m.group(2)
            cur_str = (m.group(3) or m.group(1) or "").strip()
            amount = self._parse_number(raw_num)
            if amount is not None:
                cur = self._normalize_currency(cur_str)
                return (
                    FieldResult(value=amount, confidence=0.85, raw=raw_num),
                    FieldResult(value=cur, confidence=0.8 if cur != "SEK" else 0.6, raw=cur_str),
                )

        # 3. General "Totalt" label — group 1 = amount, group 2 = currency
        m = _TOTAL_PATTERNS[1].search(text)
        if m:
            raw_num = m.group(1)
            cur_str = (m.group(2) or "").strip()
            amount = self._parse_number(raw_num)
            if amount is not None:
                cur = self._normalize_currency(cur_str)
                return (
                    FieldResult(value=amount, confidence=0.85, raw=raw_num),
                    FieldResult(value=cur, confidence=0.8 if cur != "SEK" else 0.6, raw=cur_str),
                )

        # 4. "amount NOK" on the same line (no cross-line matching)
        m = _TOTAL_PATTERNS[2].search(text)
        if m:
            raw_num = m.group(1)
            cur_str = (m.group(2) or "").strip()
            amount = self._parse_number(raw_num)
            if amount is not None:
                cur = self._normalize_currency(cur_str)
                return (
                    FieldResult(value=amount, confidence=0.85, raw=raw_num),
                    FieldResult(value=cur, confidence=0.8 if cur != "SEK" else 0.6, raw=cur_str),
                )

        # 5. Standalone currency-prefix line: "^NOK 54 936,83$"
        m = _STANDALONE_CURRENCY_AMOUNT_RE.search(text)
        if m:
            cur_str, raw_num = m.group(1), m.group(2)
            amount = self._parse_number(raw_num)
            if amount is not None:
                cur = self._normalize_currency(cur_str)
                return (
                    FieldResult(value=amount, confidence=0.85, raw=raw_num),
                    FieldResult(value=cur, confidence=0.9, raw=cur_str),
                )

        # 6. Norwegian anchor: amount immediately before "Fordringen er pantsatt"
        m = _FORDRINGEN_RE.search(text)
        if m:
            raw_num = m.group(1)
            amount = self._parse_number(raw_num)
            if amount is not None:
                return (
                    FieldResult(value=amount, confidence=0.8, raw=raw_num),
                    FieldResult(value="NOK", confidence=0.7, raw=""),
                )

        return (
            FieldResult(confidence=0.0),
            FieldResult(value="SEK", confidence=0.3, raw=""),
        )

    @staticmethod
    def _normalize_currency(raw: str) -> str:
        upper = raw.upper()
        if upper in ("SEK", "EUR", "USD", "GBP", "NOK"):
            return upper
        if upper in ("KR", ""):
            return "SEK"
        return "SEK"

    @staticmethod
    def _parse_number(s: str) -> Optional[float]:
        s = s.strip().replace("\xa0", "").replace(" ", "")
        # Norwegian/Swedish: 1.234,56  or  1 234,56
        if re.search(r"\d,\d{2}$", s):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
        try:
            return float(s)
        except ValueError:
            return None

    # ── KID (Norwegian payment reference) ─────────────────────────────

    @staticmethod
    def _extract_kid(text: str) -> FieldResult:
        # Inline "KID: 30009000000137206"
        m = _KID_RE.search(text)
        if m:
            raw = m.group(1).strip()
            return FieldResult(value=raw, confidence=0.95, raw=raw)
        # Standalone line with 15–25 digits (NYDAL payment slip layout)
        m = _KID_LINE_RE.search(text)
        if m:
            raw = m.group(1).strip()
            return FieldResult(value=raw, confidence=0.85, raw=raw)
        return FieldResult(confidence=0.0)

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
