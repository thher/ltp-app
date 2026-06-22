"""Multi-invoice PDF splitting — groups OCR page texts by invoice boundary.

Two invoice header formats are handled:

1. Inline  (all-in-one layout): "Fakturanummer: 13720" on one line.
2. Tabular (two-column layout): "Fakturanummer:" label on its own line, with
   the actual number appearing several lines later as a standalone value once
   the scanner has serialised both columns of the header box.

Detection strategy: a page that contains "Fakturanummer" marks the start of a
new invoice. Subsequent pages (continuation sheets, payment-slip-only pages)
are attached to the most recently opened invoice group.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class InvoicePageGroup:
    invoice_number: str
    page_indices: list[int]     # 0-based indices into the original page list
    page_texts: list[str]

    @property
    def combined_text(self) -> str:
        return "\n\n".join(self.page_texts)


class InvoiceSplitter:
    """Split a list of per-page OCR texts into per-invoice groups."""

    # Format 1: label + number on the same line: "Fakturanummer: 13720"
    _INLINE_RE = re.compile(r"Fakturanummer[:\s]+([0-9]{4,})", re.I)

    # Format 2: label on its own line (number comes later in the text)
    _LABEL_ONLY_RE = re.compile(r"Fakturanummer[:\s]*$", re.I | re.MULTILINE)

    # Standalone 5-digit number (invoice numbers in NYDAL PDFs are 5 digits;
    # zip codes appear as "5227 NESTTUN" — not standalone — so this is safe).
    _STANDALONE_NUM_RE = re.compile(r"^([0-9]{5})\s*$", re.MULTILINE)

    def split(self, page_texts: list[str]) -> list[InvoicePageGroup]:
        """Return one InvoicePageGroup per detected invoice start.

        Pages without a Fakturanummer header are continuation or payment-slip
        pages and are appended to the most recently opened group.
        """
        groups: list[InvoicePageGroup] = []
        current: InvoicePageGroup | None = None

        for idx, text in enumerate(page_texts):
            inv_num = self._find_invoice_number(text)
            if inv_num:
                if current is not None:
                    groups.append(current)
                current = InvoicePageGroup(
                    invoice_number=inv_num,
                    page_indices=[idx],
                    page_texts=[text],
                )
            elif current is not None:
                current.page_indices.append(idx)
                current.page_texts.append(text)

        if current is not None:
            groups.append(current)
        return groups

    def _find_invoice_number(self, text: str) -> str | None:
        # Format 1: inline — "Fakturanummer: 13720"
        m = self._INLINE_RE.search(text)
        if m:
            return m.group(1).strip()

        # Format 2: label-only line — number appears later as standalone value
        m_label = self._LABEL_ONLY_RE.search(text)
        if m_label:
            after = text[m_label.end():]
            m_num = self._STANDALONE_NUM_RE.search(after)
            if m_num:
                return m_num.group(1).strip()

        return None
