"""
Standalone PDF-to-Excel extractor -- no GUI, no Poppler required.

Works with invoices from any Norwegian supplier. Renders PDF pages with
PyMuPDF (fitz), OCRs with Tesseract, extracts line items, then aggregates
across all PDFs. Splits multi-invoice PDFs at Fakturanummer: boundaries.

Optional supplier profiles (Nydal, Byggmakker, Monter, XL-Bygg, Obs Bygg)
improve name normalisation but the generic parser works without them.

USAGE
-----
Multiple PDFs (last arg = output):

    cd invoice_summarizer
    python tools\\extract_pdf_to_excel.py "a.pdf" "b.pdf" out.xlsx

Folder of PDFs:

    python tools\\extract_pdf_to_excel.py --input-folder "C:\\PDFs" --output out.xlsx

Override Tesseract path:

    python tools\\extract_pdf_to_excel.py invoice.pdf out.xlsx ^
        --tesseract "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

SHEETS IN OUTPUT EXCEL
----------------------
  Samlet oversikt   -- one row per product across all years, with per-year
                       quantity and price columns plus totals; sorted by
                       category then spend
  2024 / 2025 / …  -- one sheet per year found in the data (dynamic);
                       same product list filtered to that year only
  Fakturaoversikt   -- one row per invoice
  Kontroll          -- uncertain / low-confidence extractions for manual review
"""
from __future__ import annotations

import os
import re
import sys
import datetime

from dataclasses import dataclass, field
from pathlib import Path

# Allow "from app.*" imports when run from invoice_summarizer/
_HERE = Path(__file__).resolve().parent
_ROOT = _HERE.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


# ── Tesseract detection ───────────────────────────────────────────────────────

_WINDOWS_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def _find_tesseract_exe(override: str | None = None) -> str | None:
    import subprocess
    if override:
        if Path(override).is_file():
            return override
        print(f"  WARNING: --tesseract path not found: {override}")
    try:
        r = subprocess.run(["tesseract", "--version"], capture_output=True, timeout=5)
        if r.returncode == 0:
            import shutil
            return shutil.which("tesseract") or "tesseract"
    except Exception:
        pass
    if sys.platform == "win32":
        for p in _WINDOWS_TESSERACT_PATHS:
            if Path(p).is_file():
                return p
        local = os.environ.get("LOCALAPPDATA", "")
        if local:
            p = Path(local) / "Programs" / "Tesseract-OCR" / "tesseract.exe"
            if p.is_file():
                return str(p)
    return None


def _setup_tesseract(override: str | None = None) -> tuple[bool, str]:
    """Return (available, lang). Configures pytesseract and PATH."""
    try:
        import pytesseract
    except ImportError:
        print("  pytesseract not installed. Run: pip install pytesseract")
        return False, ""

    import subprocess

    tess_exe = _find_tesseract_exe(override)
    if tess_exe is None:
        print("  Tesseract not found.")
        if sys.platform == "win32":
            for p in _WINDOWS_TESSERACT_PATHS:
                print(f"    checked: {p}")
            print("  Or pass: --tesseract \"C:\\Program Files\\Tesseract-OCR\\tesseract.exe\"")
        return False, ""

    pytesseract.pytesseract.tesseract_cmd = tess_exe
    print(f"  Using Tesseract: {tess_exe}")

    if sys.platform == "win32" and tess_exe != "tesseract":
        tess_dir = str(Path(tess_exe).parent)
        cur = os.environ.get("PATH", "")
        if tess_dir.lower() not in cur.lower():
            os.environ["PATH"] = tess_dir + os.pathsep + cur

    try:
        r = subprocess.run([tess_exe, "--version"], capture_output=True, timeout=10)
        if r.returncode != 0:
            print(f"  Error: {r.stderr.decode(errors='replace').strip()}")
            return False, ""
        ver = (r.stdout or r.stderr).decode(errors="replace").splitlines()
        if ver:
            print(f"  {ver[0].strip()}")
    except Exception as e:
        print(f"  Tesseract failed: {e}")
        return False, ""

    try:
        langs = pytesseract.get_languages(config="")
        lang = "nor+eng" if "nor" in langs else "eng"
    except Exception:
        lang = "eng"

    return True, lang


# ── PDF text layer extraction ─────────────────────────────────────────────────

def _extract_pdf_text(pdf_path: Path) -> tuple[str, list[str], str]:
    """Return (full_text, per_page_texts, method). No OCR."""
    try:
        import pdfplumber
        pages: list[str] = []
        with pdfplumber.open(str(pdf_path)) as pdf:
            for p in pdf.pages:
                pages.append(p.extract_text() or "")
        full = "\n\n".join(pages)
        if full.strip():
            return full, pages, "pdfplumber"
    except Exception:
        pass
    try:
        import fitz
        pages = []
        doc = fitz.open(str(pdf_path))
        for p in doc:
            pages.append(p.get_text())
        doc.close()
        full = "\n\n".join(pages)
        if full.strip():
            return full, pages, "pymupdf_text"
    except Exception:
        pass
    return "", [], "none"


# ── OCR via PyMuPDF render (no Poppler) ──────────────────────────────────────

def _ocr_pdf(pdf_path: Path, lang: str) -> tuple[str, list, list[int]]:
    """Render each page with fitz at 200 DPI, OCR with OcrEngine._ocr_image.

    Returns (full_text, list[OcrResult], char_counts_per_page).
    Uses OcrEngine's preprocessing and image_to_data word-box extraction
    so that LineItemExtractor can do spatial column parsing afterward.
    No Poppler / pdf2image required.
    """
    try:
        import fitz
        from PIL import Image
        from app.processing.ocr_engine import OcrEngine, OcrResult
    except ImportError as exc:
        print(f"  [OCR] Missing: {exc}")
        return "", [], []

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as exc:
        print(f"  [OCR] Cannot open PDF: {exc}")
        return "", [], []

    engine = OcrEngine()
    # Match OcrEngine.DPI=200 so spatial column fractions calibrated at 200 DPI work
    mat = fitz.Matrix(200 / 72, 200 / 72)
    ocr_results: list[OcrResult] = []
    char_counts: list[int] = []
    total = len(doc)

    for page_num in range(total):
        print(f"  OCR page {page_num + 1}/{total} ...", end="", flush=True)
        try:
            page = doc[page_num]
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            result = engine._ocr_image(img, lang)
            result.page_width = pix.width
            result.page_height = pix.height
        except Exception as exc:
            from app.processing.ocr_engine import OcrResult
            result = OcrResult()
            print(f" ERROR: {exc}", end="")
        ocr_results.append(result)
        char_counts.append(len(result.text))
        print(f" {len(result.text)} chars, {len(result.words)} words")

    doc.close()
    full_text = "\n\n".join(r.text for r in ocr_results)
    return full_text, ocr_results, char_counts


# ── Line item extraction ──────────────────────────────────────────────────────

def _li_to_dict(item, source_pdf: str = "", supplier: str = "",
                invoice_number: str = "") -> dict:
    mat = ""
    try:
        mat = item.material_category.name if item.material_category else ""
    except Exception:
        pass
    return {
        "Source PDF":      source_pdf,
        "Supplier":        supplier,
        "Customer":        "",
        "Invoice #":       invoice_number,
        "Description":     item.description,
        "Section":         item.section,
        "Quantity":        item.quantity,
        "Unit":            item.unit or "",
        "Unit Price":      item.unit_price,
        "Discount %":      item.discount_pct,
        "VAT %":           item.vat_pct,
        "Line Total":      item.line_total,
        "Length/unit m":   item.length_per_unit,
        "Total length m":  item.total_length,
        "Material":        mat,
        "Confidence":      round(item.confidence, 2),
    }


def _extract_line_items_spatial(ocr_results: list) -> list[dict]:
    """Use spatial LineItemExtractor (requires word bounding boxes)."""
    try:
        from app.processing.line_item_extractor import LineItemExtractor
        items = LineItemExtractor().extract_from_ocr(ocr_results)
        return [_li_to_dict(i) for i in items]
    except Exception as exc:
        print(f"  [Spatial] {exc}")
        return []


# ── Text-based line item parser (generic Norwegian building invoices) ─────────

_TABLE_HDR_RE  = re.compile(r'\b(tekst|antall|pris|bel[øo]p|beloep)\b', re.I)
_SECTION_RE    = re.compile(r'^\s*(HUS|ETG|BYGNING|AVDELING|SEKSJON|BLOKK)\b', re.I)
_STOP_RE       = re.compile(
    r'F[oø]lgende\s+bel[øo]p|Totalt\s+bel[øo]p|^\s*MVA\s*\(|Betalingsbetingelser',
    re.I
)
_BUNDLE_RE     = re.compile(
    r'^(\d+(?:[.,]\d+)?)\s+stk\s+a\s+(\d+(?:[.,]\d+)?)\s*(?:m(?:eter)?\s+)?(.+)',
    re.I
)
_UNITS         = frozenset('stk m lm lpm pk rll l kg bx m2 m3 meter pall stk.'.split())
_VAT_RATES     = frozenset(('25', '15', '12', '0'))


def _parse_no_num(s: str) -> float | None:
    """Parse Norwegian number: '1 234,56' -> 1234.56, '495,00' -> 495.0"""
    s = s.strip().replace('\xa0', '').replace(' ', '')
    if not s:
        return None
    if re.search(r'[,.]\d{1,2}$', s):
        s = re.sub(r'\.(?=\d{3})', '', s)
        s = s.replace(',', '.')
    else:
        s = s.replace(',', '').replace('.', '')
    try:
        return float(s)
    except ValueError:
        return None


def _try_parse_item(line: str, section: str) -> dict | None:
    """Try to parse one text line as a Norwegian invoice line item."""
    tokens = line.split()
    n = len(tokens)
    if n < 3:
        return None

    idx = n

    def tok(i: int) -> str | None:
        return tokens[n - i] if 1 <= i <= n else None

    def is_amount(t: str | None) -> bool:
        return bool(t and re.match(r'^\d{1,3}[,.]\d{2}$', t))

    def is_int(t: str | None) -> bool:
        return bool(t and re.match(r'^\d+$', t))

    def is_num(t: str | None) -> bool:
        return bool(t and re.match(r'^\d+(?:[.,]\d+)?$', t))

    # Step 1: line total
    t1 = tok(1)
    if not is_amount(t1):
        return None
    total_str = t1
    consumed = 1
    t2 = tok(2)
    if is_int(t2) and t2 not in _VAT_RATES:
        comb = _parse_no_num(t2 + " " + t1)
        simp = _parse_no_num(t1)
        if comb and simp and comb >= simp + 1000:
            total_str = t2 + " " + t1
            consumed = 2
    line_total = _parse_no_num(total_str)
    if not line_total:
        return None
    idx -= consumed

    # Step 2: VAT%
    vat_pct = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if nxt in _VAT_RATES:
        vat_pct = float(nxt)
        idx -= 1

    # Step 3: Discount% (1-60)
    discount_pct = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if is_int(nxt):
        v = float(nxt)
        if 1 <= v <= 60:
            discount_pct = v
            idx -= 1

    # Step 4: Unit
    unit = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if nxt and nxt.lower().rstrip('.') in _UNITS:
        unit = nxt
        idx -= 1

    # Step 5: Unit price
    unit_price = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if is_amount(nxt):
        up_str = nxt
        idx -= 1
        nxt2 = tokens[idx - 1] if idx >= 1 else None
        if is_int(nxt2) and nxt2 not in _VAT_RATES:
            comb = _parse_no_num(nxt2 + " " + nxt)
            simp = _parse_no_num(nxt)
            if comb and simp and comb >= simp + 1000:
                up_str = nxt2 + " " + nxt
                idx -= 1
        unit_price = _parse_no_num(up_str)
    elif is_num(nxt):
        unit_price = _parse_no_num(nxt)
        idx -= 1

    # Step 6: Quantity
    qty = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if is_num(nxt):
        qty = _parse_no_num(nxt)
        idx -= 1

    # Step 7: Description
    desc = " ".join(tokens[:idx])
    if not desc.strip() or len(desc) < 2:
        return None

    # Bundle: "22 stk a 4,8 28X120 PRODUCT"
    length_per_unit = None
    total_length = None
    bm = _BUNDLE_RE.match(desc)
    if bm:
        pieces = _parse_no_num(bm.group(1))
        metres = _parse_no_num(bm.group(2))
        if pieces and metres and metres < 30:
            desc = bm.group(3).strip()
            length_per_unit = metres
            total_length = pieces * metres
            if qty is None:
                qty = pieces

    confidence = 1.0
    if qty is None:
        confidence -= 0.3
    if unit_price is None:
        confidence -= 0.2

    return {
        "Source PDF":      "",
        "Supplier":        "",
        "Customer":        "",
        "Invoice #":       "",
        "Description":     desc,
        "Section":         section,
        "Quantity":        qty,
        "Unit":            unit or "",
        "Unit Price":      unit_price,
        "Discount %":      discount_pct,
        "VAT %":           vat_pct,
        "Line Total":      line_total,
        "Length/unit m":   length_per_unit,
        "Total length m":  total_length,
        "Material":        "",
        "Confidence":      round(max(0.0, confidence), 2),
    }


def _extract_line_items_text(text: str) -> list[dict]:
    """Text-based line item extraction for Norwegian building invoices."""
    lines = text.splitlines()
    items: list[dict] = []
    in_table = False
    section = ""

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if _STOP_RE.search(stripped):
            in_table = False
            continue
        if not in_table:
            if len(_TABLE_HDR_RE.findall(stripped)) >= 2:
                in_table = True
            continue
        if _SECTION_RE.match(stripped):
            section = stripped
            continue
        item = _try_parse_item(stripped, section)
        if item:
            items.append(item)

    return items


# ── Product / unit normalisation ──────────────────────────────────────────────
# Delegate to the shared module so that standalone CLI and GUI produce identical
# results.  The path setup at the top of this file ensures "app.*" is importable.

from app.processing.product_normalizer import (
    normalize_key       as _normalize_product,
    canonical_name      as _canonical_product,
    normalize_unit      as _normalize_unit,
    detect_category_key as _detect_category,
    extract_dimension   as _extract_dimension,
)

# Norwegian display names for category keys returned by detect_category_key().
_CATEGORY_DISPLAY: dict[str, str] = {
    "timber":        "Trelast",
    "terrace":       "Terrasse",
    "boards":        "Plater",
    "insulation":    "Isolasjon",
    "doors_windows": "Dører og vinduer",
    "fasteners":     "Beslag og festemidler",
    "roofing":       "Tak",
    "plumbing":      "Rør",
    "electrical":    "Elektrisk",
    "ventilation":   "Ventilasjon",
    "paint":         "Maling og overflate",
    "tools":         "Verktøy",
    "transport":     "Transport og tjenester",
    "rental":        "Leieutstyr",
    "miscellaneous": "Diverse",
    "unknown":       "Ukjent",
}


def _parse_date(s: str) -> datetime.date | None:
    """Parse Norwegian invoice date string to a date object."""
    if not s:
        return None
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            pass
    return None


# ── Supplier profiles (optional helpers for known suppliers) ──────────────────
#
# Each profile provides:
#   canonical  -- display name when the supplier is detected
#   patterns   -- regex patterns to recognise this supplier in invoice text
#
# Add new suppliers here without changing any other code.
# The generic parser works fine without a matching profile.

_SUPPLIER_PROFILES: dict[str, dict] = {
    "nydal": {
        "canonical": "Nydal Byggevarer AS",
        "patterns": [r"NYDAL\s+BYGGEVARER", r"NYDAL\s+BYGG"],
    },
    "byggmakker": {
        "canonical": "Byggmakker",
        "patterns": [r"BYGGMAKKER"],
    },
    "monter": {
        "canonical": "Monter",
        "patterns": [r"MONT[EÉ]R"],
    },
    "xl-bygg": {
        "canonical": "XL-Bygg",
        "patterns": [r"XL[\s\-]BYGG"],
    },
    "obs": {
        "canonical": "Obs Bygg",
        "patterns": [r"OBS\s+BYGG"],
    },
}

# Filename keyword -> profile key (for filename-based detection only)
_FILENAME_HINTS: dict[str, str] = {
    "nydal":       "nydal",
    "byggmakker":  "byggmakker",
    "monter":      "monter",
    "montér":      "monter",
    "xl-bygg":     "xl-bygg",
    "xl_bygg":     "xl-bygg",
    "obs":         "obs",
}


def _normalise_supplier_name(raw: str) -> str:
    """If raw matches a known profile, return the canonical display name."""
    raw_up = raw.upper()
    for profile in _SUPPLIER_PROFILES.values():
        for pat in profile["patterns"]:
            if re.search(pat, raw_up):
                return profile["canonical"]
    return raw


# ── Supplier / customer detection ─────────────────────────────────────────────

_CUSTOMER_BLOCK_RE = re.compile(
    r'(?:Faktureres?\s+til|Send\s+til|Til\s*:|Kunde\s*:|Ship\s+to|Bill\s+to)[:\s]',
    re.I,
)
_COMPANY_SUFFIX_RE = re.compile(
    r'\b(?:AS|ASA|ANS|DA|NUF|AB|GmbH|Ltd|LLC|SA|Inc|Corp|'
    r'Byggevarer|Bygg|Eiendom|Gruppen|Handel)\b',
    re.I,
)


def _scan_for_company(lines: list[str], max_lines: int = 20) -> str:
    """Return the first line that looks like a company name."""
    for line in lines[:max_lines]:
        line = line.strip()
        if not line or len(line) < 4 or len(line) > 80:
            continue
        # Accept lines with a company-suffix word OR all-caps / title-case names
        has_suffix   = bool(_COMPANY_SUFFIX_RE.search(line))
        is_caps      = bool(re.match(r'^[A-ZÆØÅ][A-ZÆØÅ\s\-\.]+$', line))
        is_titlecase = bool(re.match(r'^[A-ZÆØÅ][a-z]', line) and len(line.split()) >= 2)
        if not (has_suffix or is_caps or is_titlecase):
            continue
        if re.match(r'^\d+\s', line):          # address line starting with number
            continue
        if re.search(r'\b\d{4}\b', line):      # postal code
            continue
        if re.search(r'\b\d{2}[./]\d{2}[./]\d{4}\b', line):  # date
            continue
        return line
    return ""


def _find_supplier_and_customer(text: str, filename: str = "") -> tuple[str, str]:
    """Return (supplier, customer) detected from invoice text.

    Supplier:  text before 'Faktureres til:' marker.
    Customer:  text after  'Faktureres til:' marker.
    Falls back to filename-based profile detection for supplier.
    Returns ("", "") when nothing is found -- invoices are never discarded.
    """
    m = _CUSTOMER_BLOCK_RE.search(text)

    if m:
        supplier_raw = _scan_for_company(text[:m.start()].splitlines())
        customer_raw = _scan_for_company(text[m.end():].splitlines(), max_lines=10)
    else:
        # No customer marker -- scan the first section for the supplier
        supplier_raw = _scan_for_company(text.splitlines()[:30])
        customer_raw = ""

    # Normalise supplier name via profiles
    supplier = _normalise_supplier_name(supplier_raw) if supplier_raw else ""

    # Filename hint when text detection fails
    if not supplier and filename:
        stem = Path(filename).stem.lower()
        for keyword, profile_key in _FILENAME_HINTS.items():
            if keyword in stem:
                supplier = _SUPPLIER_PROFILES[profile_key]["canonical"]
                break

    return supplier, customer_raw


# ── Invoice splitting ─────────────────────────────────────────────────────────

_FAKTURA_NR_RE = re.compile(r'Fakturanummer\s*:', re.I)
_PAGE_BREAK_RE = re.compile(r'\n{3,}|(?:\n[ \t]*){3,}|\f')


def _split_invoices(text: str) -> list[str]:
    """Split OCR text into per-invoice blocks at 'Fakturanummer:' boundaries."""
    matches = list(_FAKTURA_NR_RE.finditer(text))
    if len(matches) <= 1:
        return [text.strip()] if text.strip() else []

    block_starts = [0]
    for i in range(1, len(matches)):
        prev_end   = matches[i - 1].end()
        curr_start = matches[i].start()
        region     = text[prev_end:curr_start]

        breaks = list(_PAGE_BREAK_RE.finditer(region))
        if breaks:
            split_pos = prev_end + breaks[-1].end()
        else:
            double_nl = list(re.finditer(r'\n[ \t]*\n', region))
            split_pos = (prev_end + double_nl[-1].end()) if double_nl else curr_start

        block_starts.append(split_pos)

    blocks: list[str] = []
    for i, start in enumerate(block_starts):
        end   = block_starts[i + 1] if i + 1 < len(block_starts) else len(text)
        block = text[start:end].strip()
        if block:
            blocks.append(block)
    return blocks


# ── Invoice header parsing ────────────────────────────────────────────────────

def _parse_invoice_block(block_text: str, filename: str = "") -> dict:
    """Extract header fields from one invoice block (generic, any supplier)."""
    supplier, customer = _find_supplier_and_customer(block_text, filename)

    def _find(patterns: list[str]) -> str:
        for pat in patterns:
            mm = re.search(pat, block_text, re.I | re.M)
            if mm:
                return mm.group(1).strip()
        return ""

    def _find_amount(patterns: list[str]):
        for pat in patterns:
            mm = re.search(pat, block_text, re.I | re.M)
            if mm:
                raw = mm.group(1).replace("\xa0", "").replace(" ", "").replace(",", ".")
                try:
                    return float(raw)
                except ValueError:
                    pass
        return None

    inv_num = _find([
        r"Fakturanummer\s*[:\s]+(\S+)",
        r"Fakturanr\.?\s*[:\s]+(\S+)",
        r"Invoice\s*(?:No|Number)\s*[:\s#]+(\S+)",
    ])
    date = _find([
        r"Fakturadato\s*[:\s]+(\d{2}[./]\d{2}[./]\d{4})",
        r"Fakturadato\s*[:\s]+(\d{4}-\d{2}-\d{2})",
        r"Invoice\s*Date\s*[:\s]+(\d{2}[./]\d{2}[./]\d{4})",
    ])
    due = _find([
        r"Forfallsdato\s*[:\s]+(\d{2}[./]\d{2}[./]\d{4})",
        r"Due\s*Date\s*[:\s]+(\d{2}[./]\d{2}[./]\d{4})",
    ])
    total = _find_amount([
        r"Totalt\s+bel[øo]p\s*[:\s]+([\d\s,.\xa0]+)",
        r"Total\s*[:\s]+([\d\s,.\xa0]+)",
        r"Netto\s+bel[øo]p\s*[:\s]+([\d\s,.\xa0]+)",
    ])
    cur_m = re.search(r"\b(NOK|SEK|EUR|USD|GBP)\b", block_text, re.I)

    return {
        "supplier":       supplier,
        "customer":       customer,
        "invoice_number": inv_num,
        "invoice_date":   date,
        "due_date":       due,
        "total":          total,
        "currency":       cur_m.group(1).upper() if cur_m else "NOK",
        "confidence":     0.7 if inv_num else 0.3,
    }


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class InvoiceData:
    source_pdf:     str
    supplier:       str
    customer:       str
    invoice_number: str
    invoice_date:   str
    due_date:       str
    total:          float | None
    currency:       str
    confidence:     float
    status:         str
    line_items:     list[dict] = field(default_factory=list)
    raw_text:       str = ""


@dataclass
class PDFResult:
    filename:          str
    path:              Path
    status:            str = "OK"
    extraction_method: str = ""
    ocr_lang:          str = ""
    page_char_counts:  list[int] = field(default_factory=list)
    raw_text:          str = ""
    invoices:          list[InvoiceData] = field(default_factory=list)
    error:             str = ""


# ── Process one PDF ───────────────────────────────────────────────────────────

def _process_pdf(
    pdf_path: Path,
    ocr_available: bool,
    ocr_lang: str,
    index: int,
    total_pdfs: int,
) -> PDFResult:
    res = PDFResult(filename=pdf_path.name, path=pdf_path)

    print(f"\n{'─'*60}")
    print(f"[{index}/{total_pdfs}] {pdf_path.name}")

    # A: PDF text layer
    print("  Text layer ...")
    text, text_pages, method = _extract_pdf_text(pdf_path)
    res.extraction_method = method
    res.page_char_counts = [len(p) for p in text_pages]

    if text.strip():
        print(f"  -> {method}: {len(text)} chars")
    else:
        print("  -> empty")

    # B: OCR when text layer < 200 chars
    ocr_results: list = []
    if len(text.strip()) < 200:
        if ocr_available:
            print("  Running OCR (fitz render, no Poppler) ...")
            ocr_text, ocr_results, page_char_counts = _ocr_pdf(pdf_path, ocr_lang)
            if ocr_text.strip():
                text = ocr_text
                res.extraction_method = "tesseract_ocr"
                res.page_char_counts = page_char_counts
                print(f"  -> OCR: {len(text)} chars total")
            else:
                print("  -> OCR produced no text")
                res.extraction_method = "failed"
                res.status = "Needs Review"
        else:
            print("  -> No text layer and Tesseract not available")
            res.extraction_method = "failed"
            res.status = "Needs Review"

    res.raw_text = text

    # C: Split into per-invoice blocks
    print("  Splitting invoices ...")
    blocks   = _split_invoices(text)
    n_blocks = len(blocks)
    print(f"  -> {n_blocks} invoice block(s)")

    if not blocks:
        res.status = "Failed"
        return res

    # D: Process each invoice block
    for block_idx, block_text in enumerate(blocks):
        block_num = block_idx + 1
        print(f"\n  --- Invoice {block_num}/{n_blocks} ---")

        header     = _parse_invoice_block(block_text, filename=pdf_path.name)
        supplier   = header.get("supplier") or ""
        customer   = header.get("customer") or ""
        inv_num    = header.get("invoice_number") or ""
        inv_date   = header.get("invoice_date") or ""
        due_date   = header.get("due_date") or ""
        total      = header.get("total")
        currency   = header.get("currency") or "NOK"
        confidence = header.get("confidence") or 0.0

        print(f"  Supplier : {supplier or '(not detected)'}")
        print(f"  Customer : {customer or '(not detected)'}")
        print(f"  Invoice# : {inv_num or '(not found)'}")
        print(f"  Date     : {inv_date or '(not found)'}")
        print(f"  Due      : {due_date or '(not found)'}")
        print(f"  Total    : {total} {currency}")

        # E: Line items
        print("  Extracting line items ...")
        if n_blocks == 1 and ocr_results:
            # Single invoice: spatial extraction has word bounding boxes
            items = _extract_line_items_spatial(ocr_results)
            if items:
                print(f"  -> Spatial: {len(items)} items")
            else:
                print("  -> Spatial: 0, trying text ...")
                items = _extract_line_items_text(block_text)
                print(f"  -> Text: {len(items)} items")
        else:
            items = _extract_line_items_text(block_text)
            print(f"  -> Text: {len(items)} items")

        # Tag each item with invoice metadata
        for item in items:
            item["Source PDF"] = pdf_path.name
            item["Supplier"]   = supplier
            item["Customer"]   = customer
            item["Invoice #"]  = inv_num

        # Always create the invoice entry — never discard
        inv_status = "OK" if (inv_num or total) else "Needs Review"
        res.invoices.append(InvoiceData(
            source_pdf=pdf_path.name,
            supplier=supplier,
            customer=customer,
            invoice_number=inv_num,
            invoice_date=inv_date,
            due_date=due_date,
            total=total,
            currency=currency,
            confidence=confidence,
            status=inv_status,
            line_items=items,
            raw_text=block_text,
        ))

    # Overall PDF status
    if not res.invoices:
        res.status = "Failed"
    elif any(inv.status != "OK" for inv in res.invoices):
        res.status = "Needs Review"
    else:
        res.status = "OK"

    total_items = sum(len(inv.line_items) for inv in res.invoices)
    total_spend = sum(inv.total or 0 for inv in res.invoices)
    print(f"\n  Total: {len(res.invoices)} invoice(s) | "
          f"{total_items} line items | {total_spend:,.0f} NOK")

    return res


# ── Aggregation ───────────────────────────────────────────────────────────────

def _collect_product_data(results: list[PDFResult]) -> list[dict]:
    """Aggregate all line items by (normalised product, normalised unit).

    Noise words (UH., JUST., MM, MOELVEN) are stripped and dimension
    notation is normalised before grouping, so the same product described
    differently by different suppliers ends up in the same bucket.

    Returns a flat list of group dicts (one per unique product+unit).
    """
    groups: dict[str, dict] = {}

    for res in results:
        for inv in res.invoices:
            for item in inv.line_items:
                desc = item.get("Description", "").strip()
                if not desc or len(desc) < 2:
                    continue

                unit      = item.get("Unit", "") or ""
                norm_prod = _normalize_product(desc)
                norm_unit = _normalize_unit(unit)
                agg_key   = f"{norm_prod}|{norm_unit}"

                if agg_key not in groups:
                    groups[agg_key] = {
                        "norm_key":       norm_prod,
                        "display":        _canonical_product(desc),
                        "unit":           unit,
                        "norm_unit":      norm_unit,
                        "category":       _detect_category(norm_prod),
                        "dimension":      _extract_dimension(norm_prod),
                        "qty":            0.0,
                        "total_length_m": 0.0,
                        "total_spend":    0.0,
                        "appearances":    0,
                        "suppliers":      set(),
                        "pdfs":           set(),
                        "invoices":       set(),
                        "dates":          [],
                        "by_year":        {},
                    }

                g = groups[agg_key]
                # Prefer shorter canonical display (less noise)
                candidate = _canonical_product(desc)
                if candidate and (not g["display"] or len(candidate) < len(g["display"])):
                    g["display"] = candidate

                qty = item.get("Quantity")
                if qty:
                    g["qty"] += qty
                tl = item.get("Total length m")
                if tl:
                    g["total_length_m"] += tl
                lt = item.get("Line Total")
                if lt:
                    g["total_spend"] += lt
                g["appearances"] += 1
                if inv.supplier:
                    g["suppliers"].add(inv.supplier)
                g["pdfs"].add(res.filename)
                if inv.invoice_number:
                    g["invoices"].add(inv.invoice_number)
                d = _parse_date(inv.invoice_date)
                if d:
                    g["dates"].append(d)
                    yr = d.year
                    if yr not in g["by_year"]:
                        g["by_year"][yr] = {"qty": 0.0, "spend": 0.0}
                    g["by_year"][yr]["qty"]   += qty or 0
                    g["by_year"][yr]["spend"] += lt  or 0

    return list(groups.values())


def _needs_review_items(results: list[PDFResult]) -> list[dict]:
    """Collect line items with low confidence or from problematic invoices."""
    rows = []
    for res in results:
        for inv in res.invoices:
            inv_flagged = inv.status == "Needs Review"
            for item in inv.line_items:
                conf = item.get("Confidence") or 1.0
                desc = (item.get("Description") or "").strip()
                issues = []
                if conf < 0.7:
                    issues.append(f"low confidence ({conf:.0%})")
                if inv_flagged:
                    issues.append("invoice needs review")
                if len(desc) < 5:
                    issues.append("short description")
                if not issues:
                    continue
                rows.append({
                    "Source PDF":  item.get("Source PDF") or "",
                    "Supplier":    item.get("Supplier") or "",
                    "Invoice #":   item.get("Invoice #") or "",
                    "Description": desc,
                    "Quantity":    item.get("Quantity"),
                    "Unit":        item.get("Unit") or "",
                    "Unit Price":  item.get("Unit Price"),
                    "Line Total":  item.get("Line Total"),
                    "Confidence":  round(conf, 2),
                    "Issue":       "; ".join(issues),
                })
    return rows


# ── Excel writer ──────────────────────────────────────────────────────────────

def _write_excel(output_path: Path, results: list[PDFResult]) -> None:
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError:
        print("ERROR: openpyxl not installed. Run: pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.Workbook()

    TITLE_FONT = Font(bold=True, size=13)
    HDR_FONT   = Font(bold=True, size=11)
    BOLD_FONT  = Font(bold=True)
    HDR_FILL   = PatternFill("solid", fgColor="D9E1F2")  # light blue header
    FLAG_FILL  = PatternFill("solid", fgColor="FFF3CD")  # amber — needs review
    OK_FILL    = PatternFill("solid", fgColor="D4EDDA")  # green
    WARN_FILL  = PatternFill("solid", fgColor="FFF3CD")  # amber
    FAIL_FILL  = PatternFill("solid", fgColor="F8D7DA")  # red

    def _hdr(ws, row: int, cols: list[str]) -> None:
        for c, label in enumerate(cols, 1):
            cell = ws.cell(row=row, column=c, value=label)
            cell.font = HDR_FONT
            cell.fill = HDR_FILL

    def _widths(ws, widths: list[int]) -> None:
        for c, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(c)].width = w

    def _title(ws, text: str, cols: int) -> None:
        ws["A1"] = text
        ws["A1"].font = TITLE_FONT
        if cols > 1:
            ws.merge_cells(f"A1:{get_column_letter(cols)}1")
        ws.row_dimensions[1].height = 20

    def _sort_products(data: list[dict], year: int | None = None) -> list[dict]:
        """Sort by category display name, then descending spend for the given year (or total)."""
        def _key(g: dict) -> tuple:
            cat = _CATEGORY_DISPLAY.get(g["category"], g["category"])
            if year is not None:
                spend = -(g["by_year"].get(year, {}).get("spend", 0) or 0)
            else:
                spend = -(g["total_spend"] or 0)
            return (cat, spend)
        return sorted(data, key=_key)

    def _write_product_sheet(
        ws,
        title_text: str,
        rows: list[dict],        # already sorted product group dicts
        flagged_keys: set[str],
        year: int | None = None,
    ) -> None:
        """Write a simple product sheet (used for per-year and totals-only views)."""
        COLS = ["Vare / produkt", "Kategori", "Enhet",
                "Total mengde", "Total pris (NOK)", "Kommentar"]
        _title(ws, title_text, len(COLS))
        _hdr(ws, 2, COLS)

        grand = 0.0
        for r, g in enumerate(rows, start=3):
            if year is not None:
                yd        = g["by_year"].get(year, {})
                qty_val   = round(yd.get("qty", 0), 2)   if yd.get("qty")   else None
                price_val = round(yd.get("spend", 0), 2) if yd.get("spend") else None
            else:
                qty_val   = round(g["qty"], 2)          if g["qty"]          else None
                price_val = round(g["total_spend"], 2)  if g["total_spend"]  else None

            cat_disp  = _CATEGORY_DISPLAY.get(g["category"], g["category"].title())
            unit_disp = g["norm_unit"] or g["unit"] or ""
            comment   = "Trenger kontroll" if g["norm_key"] in flagged_keys else ""

            row_vals = [g["display"], cat_disp, unit_disp, qty_val, price_val, comment]
            for c, val in enumerate(row_vals, 1):
                cell = ws.cell(row=r, column=c, value=val)
                if comment:
                    cell.fill = FLAG_FILL

            if price_val:
                grand += price_val

        total_row = len(rows) + 3
        ws.cell(row=total_row, column=1, value="TOTALT").font = BOLD_FONT
        ws.cell(row=total_row, column=5, value=round(grand, 2)).font = BOLD_FONT
        _widths(ws, [44, 24, 10, 14, 18, 20])

    # ── Collect data ──────────────────────────────────────────────────────────
    all_invoices: list[InvoiceData] = [inv for res in results for inv in res.invoices]
    product_data: list[dict]        = _collect_product_data(results)
    review_items: list[dict]        = _needs_review_items(results)

    flagged_keys: set[str] = {
        _normalize_product((r.get("Description") or "").strip())
        for r in review_items
    }

    all_years: list[int] = sorted({
        yr for g in product_data for yr in g["by_year"]
    })

    n_inv = len(all_invoices)
    n_pdf = len(results)

    # ── Sheet 1: Samlet oversikt (year columns + totals) ──────────────────────
    ws1 = wb.active
    ws1.title = "Samlet oversikt"

    year_col_headers: list[str] = []
    for yr in all_years:
        year_col_headers += [f"{yr} mengde", f"{yr} pris (NOK)"]

    COLS1 = (
        ["Vare / produkt", "Kategori", "Enhet"]
        + year_col_headers
        + ["Total mengde", "Total pris (NOK)", "Kommentar"]
    )
    _title(ws1, f"Samlet oversikt — {n_inv} faktura(er) fra {n_pdf} PDF(er)", len(COLS1))
    _hdr(ws1, 2, COLS1)

    sorted_all = _sort_products(product_data)
    grand_total = 0.0

    for r, g in enumerate(sorted_all, start=3):
        total_qty   = round(g["qty"], 2)         if g["qty"]         else None
        total_price = round(g["total_spend"], 2) if g["total_spend"] else None
        cat_disp    = _CATEGORY_DISPLAY.get(g["category"], g["category"].title())
        unit_disp   = g["norm_unit"] or g["unit"] or ""
        comment     = "Trenger kontroll" if g["norm_key"] in flagged_keys else ""

        year_vals: list = []
        for yr in all_years:
            yd = g["by_year"].get(yr, {})
            year_vals.append(round(yd.get("qty", 0), 2)   if yd.get("qty")   else None)
            year_vals.append(round(yd.get("spend", 0), 2) if yd.get("spend") else None)

        row_vals = [g["display"], cat_disp, unit_disp] + year_vals + [total_qty, total_price, comment]
        for c, val in enumerate(row_vals, 1):
            cell = ws1.cell(row=r, column=c, value=val)
            if comment:
                cell.fill = FLAG_FILL

        if total_price:
            grand_total += total_price

    total_row_1 = len(sorted_all) + 3
    ws1.cell(row=total_row_1, column=1, value="TOTALT").font = BOLD_FONT
    total_price_col = COLS1.index("Total pris (NOK)") + 1
    ws1.cell(row=total_row_1, column=total_price_col, value=round(grand_total, 2)).font = BOLD_FONT

    base_w  = [44, 24, 10]
    year_w  = [13, 16] * len(all_years)
    end_w   = [14, 18, 20]
    _widths(ws1, base_w + year_w + end_w)

    # ── Sheets 2…N: one sheet per year ───────────────────────────────────────
    for yr in all_years:
        yr_products = [g for g in product_data if yr in g["by_year"]]
        yr_sorted   = _sort_products(yr_products, year=yr)
        ws_yr = wb.create_sheet(str(yr))
        _write_product_sheet(
            ws_yr,
            title_text=f"{yr} — {len(yr_products)} produkt(er)",
            rows=yr_sorted,
            flagged_keys=flagged_keys,
            year=yr,
        )

    # ── Sheet: Fakturaoversikt ────────────────────────────────────────────────
    ws_f = wb.create_sheet("Fakturaoversikt")
    _title(ws_f, f"Fakturaoversikt — {n_inv} faktura(er) fra {n_pdf} PDF(er)", 8)

    COLS_F = ["Faktura nr", "Leverandør", "Fakturadato", "Forfallsdato",
              "Valuta", "Total (NOK)", "Varelinjer", "Status"]
    _hdr(ws_f, 2, COLS_F)

    for r, inv in enumerate(all_invoices, start=3):
        status_no = "OK" if inv.status == "OK" else "Kontroll"
        row_vals = [
            inv.invoice_number or "(ikke funnet)",
            inv.supplier       or "(ukjent)",
            inv.invoice_date   or "",
            inv.due_date       or "",
            inv.currency       or "NOK",
            inv.total,
            len(inv.line_items),
            status_no,
        ]
        fill = OK_FILL if inv.status == "OK" else WARN_FILL if inv.status == "Needs Review" else FAIL_FILL
        for c, val in enumerate(row_vals, 1):
            cell = ws_f.cell(row=r, column=c, value=val)
            if c == len(COLS_F):
                cell.fill = fill

    _widths(ws_f, [18, 28, 14, 14, 8, 16, 12, 10])

    # ── Sheet: Kontroll ───────────────────────────────────────────────────────
    ws_k = wb.create_sheet("Kontroll")
    _title(ws_k, "Kontroll — usikre linjer som krever manuell sjekk", 8)

    if review_items:
        COLS_K = ["Beskrivelse", "Leverandør", "Faktura nr", "Antall",
                  "Enhet", "Enhetspris", "Totalsum (NOK)", "Årsak"]
        _hdr(ws_k, 2, COLS_K)
        for r, item in enumerate(review_items, start=3):
            row_vals = [
                item.get("Description") or "",
                item.get("Supplier")    or "",
                item.get("Invoice #")   or "",
                item.get("Quantity"),
                item.get("Unit")        or "",
                item.get("Unit Price"),
                item.get("Line Total"),
                item.get("Issue")       or "",
            ]
            for c, val in enumerate(row_vals, 1):
                ws_k.cell(row=r, column=c, value=val).fill = FLAG_FILL
        _widths(ws_k, [44, 26, 16, 10, 8, 14, 16, 44])
    else:
        ws_k.cell(row=2, column=1,
                  value="Ingen usikre linjer funnet — alle utdrag godkjent.").font = Font(italic=True)
        _widths(ws_k, [60])

    wb.save(str(output_path))


# ── Arg parsing ───────────────────────────────────────────────────────────────

def _parse_args() -> tuple[list[Path], Path, str | None]:
    args = sys.argv[1:]
    tess_override: str | None = None
    input_folder: Path | None = None
    output_path:  Path | None = None
    positional:   list[str]   = []

    i = 0
    while i < len(args):
        a = args[i]
        if a == "--tesseract" and i + 1 < len(args):
            tess_override = args[i + 1]; i += 2
        elif a in ("--input-folder", "--folder") and i + 1 < len(args):
            input_folder = Path(args[i + 1]); i += 2
        elif a in ("--output", "-o") and i + 1 < len(args):
            output_path = Path(args[i + 1]); i += 2
        else:
            positional.append(a); i += 1

    if input_folder:
        if not input_folder.is_dir():
            print(f"ERROR: Folder not found: {input_folder}"); sys.exit(1)
        pdfs = sorted(input_folder.glob("*.pdf")) + sorted(input_folder.glob("*.PDF"))
        if not pdfs:
            print(f"ERROR: No PDFs in {input_folder}"); sys.exit(1)
    elif positional:
        if output_path is None:
            output_path = Path(positional.pop())
        pdfs = [Path(p) for p in positional]
    else:
        print(__doc__)
        print("ERROR: Provide PDF files or --input-folder."); sys.exit(1)

    if output_path is None:
        print("ERROR: Specify output (last arg or --output <file>)."); sys.exit(1)

    missing = [p for p in pdfs if not p.exists()]
    if missing:
        for m in missing:
            print(f"ERROR: Not found: {m}")
        sys.exit(1)

    return pdfs, output_path.resolve(), tess_override


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    pdfs, output_xlsx, tess_override = _parse_args()
    output_xlsx.parent.mkdir(parents=True, exist_ok=True)
    raw_text_path = output_xlsx.parent / (output_xlsx.stem + "_raw_text.txt")

    print(f"\n{'='*60}")
    print(f"PDF Extractor -- {len(pdfs)} file(s)")
    print(f"{'='*60}")
    for p in pdfs:
        print(f"  {p.name}")
    print(f"Output: {output_xlsx}\n")

    print("[Setup] Tesseract ...")
    ocr_available, ocr_lang = _setup_tesseract(tess_override)
    print(f"  OCR language: {ocr_lang}" if ocr_available else "  PDF text layer only")

    results: list[PDFResult] = []
    for idx, pdf_path in enumerate(pdfs, start=1):
        try:
            res = _process_pdf(pdf_path, ocr_available, ocr_lang, idx, len(pdfs))
        except Exception as exc:
            print(f"  FAILED: {exc}")
            res = PDFResult(
                filename=pdf_path.name, path=pdf_path,
                status="Failed", error=str(exc),
            )
        results.append(res)

    # Save concatenated raw text
    parts = []
    for res in results:
        sep = "=" * 70
        parts.append(f"{sep}\nFILE: {res.filename}\n{sep}\n{res.raw_text}\n")
    raw_text_path.write_text("\n".join(parts), encoding="utf-8")

    # Write Excel
    print(f"\n[Writing] {output_xlsx.name} ...")
    _write_excel(output_xlsx, results)

    # Final summary
    all_invoices = [inv for res in results for inv in res.invoices]
    total_items  = sum(len(inv.line_items) for inv in all_invoices)
    total_spend  = sum(inv.total or 0 for inv in all_invoices)

    print(f"\n{'='*60}")
    print(f"DONE -- {len(results)} PDF(s) | {len(all_invoices)} invoice(s) | "
          f"{total_items} line items | {total_spend:,.0f} NOK total")
    print(f"{'='*60}")
    for res in results:
        flag = "[OK]    " if res.status == "OK" else \
               "[REVIEW]" if res.status == "Needs Review" else "[FAIL]  "
        print(f"  {flag} {res.filename}  ({len(res.invoices)} invoice(s))")
        for inv in res.invoices:
            tot = f"{inv.total:,.0f} {inv.currency}" if inv.total else "(not found)"
            sup = inv.supplier or "(unknown supplier)"
            cus = inv.customer or "(unknown customer)"
            print(f"           #{inv.invoice_number or '?'} | "
                  f"{sup} -> {cus} | "
                  f"{tot} | {len(inv.line_items)} items")

    print(f"\nExcel    -> {output_xlsx}")
    print(f"Raw text -> {raw_text_path}")

    needs_review = [r for r in results if r.status != "OK"]
    if needs_review:
        print(f"\n{len(needs_review)} PDF(s) need review -- check 'Invoices' sheet.")


if __name__ == "__main__":
    main()
