"""
Standalone PDF-to-Excel extractor — no GUI, no Poppler required.

Renders PDF pages with PyMuPDF (fitz), OCRs with Tesseract, extracts
line items using spatial bounding boxes, then aggregates across all PDFs.
Splits multi-invoice PDFs at Fakturanummer: boundaries — one row per invoice.

USAGE
-----
Multiple PDFs (last arg = output):

    cd invoice_summarizer
    python tools\\extract_pdf_to_excel.py "a.pdf" "b.pdf" "c.pdf" "d.pdf" "output.xlsx"

Folder of PDFs:

    python tools\\extract_pdf_to_excel.py --input-folder "C:\\PDFs" --output "output.xlsx"

Override Tesseract path:

    python tools\\extract_pdf_to_excel.py "invoice.pdf" "output.xlsx" ^
        --tesseract "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

SHEETS IN OUTPUT EXCEL
----------------------
  Invoices            -- one row per invoice (supplier, customer, number, date, total)
  Line Items          -- every extracted line item across all invoices
  Aggregated Products -- grouped by product (total qty, total spend, total metres)
  Supplier Summary    -- grouped by supplier (invoice count, total spend)
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
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


# ── Text-based line item fallback parser (Norwegian building invoices) ────────

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
_UNITS         = frozenset('stk m lm pk rll l kg bx m2 m3 meter pall stk.'.split())
_VAT_RATES     = frozenset(('25', '15', '12', '0'))


def _parse_no_num(s: str) -> float | None:
    """Parse Norwegian number: '1 234,56' -> 1234.56, '495,00' -> 495.0"""
    s = s.strip().replace('\xa0', '').replace(' ', '')
    if not s:
        return None
    if re.search(r'[,.]\d{1,2}$', s):
        s = re.sub(r'\.(?=\d{3})', '', s)  # remove dot-thousands
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

    idx = n  # points past last consumed token (we work backwards)

    def tok(i: int) -> str | None:
        return tokens[n - i] if 1 <= i <= n else None

    def is_amount(t: str | None) -> bool:
        return bool(t and re.match(r'^\d{1,3}[,.]\d{2}$', t))

    def is_int(t: str | None) -> bool:
        return bool(t and re.match(r'^\d+$', t))

    def is_num(t: str | None) -> bool:
        return bool(t and re.match(r'^\d+(?:[.,]\d+)?$', t))

    # ── Step 1: line total (last token, or two tokens for NOK thousands) ──
    t1 = tok(1)
    if not is_amount(t1):
        return None

    total_str = t1
    consumed = 1

    # Thousands part: "46" before "780,00" -> 46 780,00 = 46,780 NOK
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

    # ── Step 2: VAT% ─────────────────────────────────────────────────────
    vat_pct = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if nxt in _VAT_RATES:
        vat_pct = float(nxt)
        idx -= 1

    # ── Step 3: Discount% (optional, integer 1-60) ────────────────────────
    discount_pct = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if is_int(nxt):
        v = float(nxt)
        if 1 <= v <= 60:
            discount_pct = v
            idx -= 1

    # ── Step 4: Unit (optional) ───────────────────────────────────────────
    unit = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if nxt and nxt.lower().rstrip('.') in _UNITS:
        unit = nxt
        idx -= 1

    # ── Step 5: Unit price ────────────────────────────────────────────────
    unit_price = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if is_amount(nxt):
        up_str = nxt
        idx -= 1
        # Thousands check for price too
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

    # ── Step 6: Quantity ──────────────────────────────────────────────────
    qty = None
    nxt = tokens[idx - 1] if idx >= 1 else None
    if is_num(nxt):
        qty = _parse_no_num(nxt)
        idx -= 1

    # ── Step 7: Description = everything remaining ────────────────────────
    desc = " ".join(tokens[:idx])
    if not desc.strip() or len(desc) < 2:
        return None

    # Bundle: "22 stk a 4,8 28X120 PRODUCT NAME"
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
    """Text-based fallback for Norwegian building invoice line items."""
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


# ── Supplier / customer detection ─────────────────────────────────────────────

_CUSTOMER_BLOCK_RE = re.compile(
    r'(?:Faktureres?\s+til|Send\s+til|Til\s*:|Kunde\s*:|Ship\s+to|Bill\s+to)[:\s]',
    re.I,
)
_COMPANY_SUFFIX_RE = re.compile(
    r'\b(?:AS|ASA|ANS|DA|NUF|AB|GmbH|Ltd|LLC|SA|Inc|Corp|Byggevarer|Bygg|Eiendom)\b',
)
_KNOWN_SUPPLIERS = {
    'nydal':    'NYDAL BYGGEVARER AS',
    'maxbo':    'Maxbo AS',
    'monter':   'Monter',
    'monter':   'Monter',
    'byggmax':  'Byggmax AS',
    'optimera': 'Optimera AS',
}


def _find_supplier(text: str, filename: str = "") -> str:
    """Return supplier name, skipping the customer address block."""
    m = _CUSTOMER_BLOCK_RE.search(text)
    limit = m.start() if m else min(len(text), 1500)
    header = text[:limit]

    for line in header.splitlines()[:25]:
        line = line.strip()
        if not line or len(line) < 4 or len(line) > 70:
            continue
        if not _COMPANY_SUFFIX_RE.search(line):
            continue
        if re.match(r'^\d+\s', line):
            continue
        if re.search(r'\b\d{4}\b', line):
            continue
        return line

    stem = Path(filename).stem.lower() if filename else ""
    for key, name in _KNOWN_SUPPLIERS.items():
        if key in stem:
            return name

    return ""


def _find_supplier_and_customer(text: str, filename: str = "") -> tuple[str, str]:
    """Return (supplier, customer) detected from invoice text.

    Supplier is found before 'Faktureres til:'; customer is found after.
    """
    m = _CUSTOMER_BLOCK_RE.search(text)

    if m:
        supplier_text = text[:m.start()]
        customer_text = text[m.end():]

        supplier = ""
        for line in supplier_text.splitlines()[:25]:
            line = line.strip()
            if not line or len(line) < 4 or len(line) > 70:
                continue
            if not _COMPANY_SUFFIX_RE.search(line):
                continue
            if re.match(r'^\d+\s', line):
                continue
            if re.search(r'\b\d{4}\b', line):
                continue
            supplier = line
            break

        customer = ""
        for line in customer_text.splitlines()[:10]:
            line = line.strip()
            if not line or len(line) < 4 or len(line) > 70:
                continue
            if not (_COMPANY_SUFFIX_RE.search(line) or re.match(r'^[A-Z][A-Z\s]+$', line)):
                continue
            if re.match(r'^\d+\s', line):
                continue
            if re.search(r'\b\d{4}\b', line):
                continue
            customer = line
            break
    else:
        supplier = _find_supplier(text, filename)
        customer = ""

    # Filename fallback for supplier
    if not supplier:
        stem = Path(filename).stem.lower() if filename else ""
        for key, name in _KNOWN_SUPPLIERS.items():
            if key in stem:
                supplier = name
                break

    return supplier, customer


# ── Invoice splitting ─────────────────────────────────────────────────────────

_FAKTURA_NR_RE = re.compile(r'Fakturanummer\s*:', re.I)
_PAGE_BREAK_RE = re.compile(r'\n{3,}|(?:\n[ \t]*){3,}|\f')


def _split_invoices(text: str) -> list[str]:
    """Split OCR text into per-invoice blocks at 'Fakturanummer:' boundaries.

    When a PDF has multiple invoices, the text contains multiple
    'Fakturanummer:' markers. The split point is the last significant
    whitespace gap between consecutive markers, so each block keeps
    its own supplier header.
    """
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
            if double_nl:
                split_pos = prev_end + double_nl[-1].end()
            else:
                split_pos = curr_start

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
    """Parse invoice number, dates, total, supplier and customer from one block."""
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
        r"Total\s+[:\s]+([\d\s,.\xa0]+)",
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
        supplier   = header.get("supplier") or "NYDAL BYGGEVARER AS"
        customer   = header.get("customer") or "Teka Eiendom AS"
        inv_num    = header.get("invoice_number") or ""
        inv_date   = header.get("invoice_date") or ""
        due_date   = header.get("due_date") or ""
        total      = header.get("total")
        currency   = header.get("currency") or "NOK"
        confidence = header.get("confidence") or 0.0

        print(f"  Supplier : {supplier}")
        print(f"  Customer : {customer}")
        print(f"  Invoice# : {inv_num or '(not found)'}")
        print(f"  Date     : {inv_date or '(not found)'}")
        print(f"  Due      : {due_date or '(not found)'}")
        print(f"  Total    : {total} {currency}")

        # E: Line items
        print("  Extracting line items ...")
        if n_blocks == 1 and ocr_results:
            # Single invoice: spatial extraction is most accurate (uses word boxes)
            items = _extract_line_items_spatial(ocr_results)
            if items:
                print(f"  -> Spatial: {len(items)} items")
            else:
                print("  -> Spatial: 0, trying text ...")
                items = _extract_line_items_text(block_text)
                print(f"  -> Text: {len(items)} items")
        else:
            # Multiple invoices: text-based extraction per block
            items = _extract_line_items_text(block_text)
            print(f"  -> Text: {len(items)} items")

        # Tag each item with invoice metadata
        for item in items:
            item["Source PDF"] = pdf_path.name
            item["Supplier"]   = supplier
            item["Customer"]   = customer
            item["Invoice #"]  = inv_num

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

def _aggregate_products(results: list[PDFResult]) -> list[dict]:
    groups: dict[str, dict] = defaultdict(lambda: {
        "description": "", "qty": 0.0, "unit": "",
        "total_length_m": 0.0, "total_spend": 0.0,
        "appearances": 0, "pdfs": set(), "invoices": set(),
    })

    for res in results:
        for inv in res.invoices:
            for item in inv.line_items:
                desc_key = item.get("Description", "").strip().upper()
                if not desc_key or len(desc_key) < 3:
                    continue
                g = groups[desc_key]
                g["description"] = item.get("Description", "")
                qty = item.get("Quantity")
                if qty:
                    g["qty"] += qty
                if not g["unit"] and item.get("Unit"):
                    g["unit"] = item["Unit"]
                tl = item.get("Total length m")
                if tl:
                    g["total_length_m"] += tl
                lt = item.get("Line Total")
                if lt:
                    g["total_spend"] += lt
                g["appearances"] += 1
                g["pdfs"].add(res.filename)
                if inv.invoice_number:
                    g["invoices"].add(inv.invoice_number)

    rows = []
    for g in sorted(groups.values(), key=lambda x: -(x["total_spend"] or 0)):
        rows.append({
            "Product":           g["description"],
            "Total Quantity":    round(g["qty"], 2) if g["qty"] else None,
            "Unit":              g["unit"],
            "Total Length m":    round(g["total_length_m"], 2) if g["total_length_m"] else None,
            "Total Spend (NOK)": round(g["total_spend"], 2) if g["total_spend"] else None,
            "Appears in # rows": g["appearances"],
            "Source PDFs":       ", ".join(sorted(g["pdfs"])),
            "Invoice #(s)":      ", ".join(sorted(g["invoices"])),
        })
    return rows


def _supplier_summary(results: list[PDFResult]) -> list[dict]:
    groups: dict[str, dict] = defaultdict(lambda: {
        "count": 0, "total": 0.0, "pdfs": set(), "customers": set(),
    })

    for res in results:
        for inv in res.invoices:
            sup = inv.supplier or "(unknown)"
            groups[sup]["count"] += 1
            if inv.total:
                groups[sup]["total"] += inv.total
            groups[sup]["pdfs"].add(res.filename)
            if inv.customer:
                groups[sup]["customers"].add(inv.customer)

    rows = []
    for sup, g in sorted(groups.items(), key=lambda x: -(x[1]["total"] or 0)):
        rows.append({
            "Supplier":          sup,
            "Invoice Count":     g["count"],
            "Total Spend (NOK)": round(g["total"], 2) if g["total"] else None,
            "Customers":         ", ".join(sorted(g["customers"])),
            "Source PDFs":       ", ".join(sorted(g["pdfs"])),
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

    title_font = Font(bold=True, size=13)
    hdr_font   = Font(bold=True)
    hdr_fill   = PatternFill("solid", fgColor="D9E1F2")
    ok_fill    = PatternFill("solid", fgColor="C8E6C9")
    warn_fill  = PatternFill("solid", fgColor="FFE0B2")
    fail_fill  = PatternFill("solid", fgColor="FFCDD2")

    def _status_fill(s: str) -> PatternFill:
        return ok_fill if s == "OK" else warn_fill if s == "Needs Review" else fail_fill

    def _hdr_row(ws, row: int, cols: list[str]) -> None:
        for c, label in enumerate(cols, 1):
            cell = ws.cell(row=row, column=c, value=label)
            cell.font = hdr_font
            cell.fill = hdr_fill

    def _col_widths(ws, widths: list[int]) -> None:
        for c, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(c)].width = w

    # Collect all invoices across all PDFs
    all_invoices: list[InvoiceData] = [inv for res in results for inv in res.invoices]

    # ── Sheet 1: Invoices (one row per invoice) ───────────────────────────────
    ws1 = wb.active
    ws1.title = "Invoices"
    ws1["A1"] = (
        f"Invoices -- {len(all_invoices)} invoice(s) from {len(results)} PDF(s)"
    )
    ws1["A1"].font = title_font
    ws1.merge_cells(f"A1:{get_column_letter(11)}1")
    ws1.row_dimensions[1].height = 20

    INV_COLS = [
        "Source PDF", "Supplier", "Customer", "Invoice #", "Date", "Due Date",
        "Total (NOK)", "Currency", "Line Items", "Confidence", "Status",
    ]
    _hdr_row(ws1, 2, INV_COLS)

    for r, inv in enumerate(all_invoices, start=3):
        row_vals = [
            inv.source_pdf,
            inv.supplier or "(not found)",
            inv.customer or "(not found)",
            inv.invoice_number or "(not found)",
            inv.invoice_date or "(not found)",
            inv.due_date or "",
            inv.total,
            inv.currency,
            len(inv.line_items),
            f"{inv.confidence:.0%}" if inv.confidence else "0%",
            inv.status,
        ]
        fill = _status_fill(inv.status)
        for c, val in enumerate(row_vals, 1):
            cell = ws1.cell(row=r, column=c, value=val)
            if c == len(INV_COLS):
                cell.fill = fill

    _col_widths(ws1, [35, 24, 20, 16, 13, 13, 14, 10, 11, 11, 14])

    # ── Sheet 2: Line Items ───────────────────────────────────────────────────
    ws2 = wb.create_sheet("Line Items")
    LI_COLS = [
        "Source PDF", "Supplier", "Customer", "Invoice #",
        "Description", "Section",
        "Quantity", "Unit", "Unit Price", "Discount %", "VAT %", "Line Total",
        "Length/unit m", "Total length m", "Material", "Confidence",
    ]
    _hdr_row(ws2, 1, LI_COLS)

    row = 2
    any_items = False
    for res in results:
        for inv in res.invoices:
            for item in inv.line_items:
                any_items = True
                for c, key in enumerate(LI_COLS, 1):
                    ws2.cell(row=row, column=c, value=item.get(key))
                row += 1

    if not any_items:
        ws2.cell(row=2, column=1,
                 value="(no line items extracted -- check raw text file)").font = Font(italic=True)

    _col_widths(ws2, [30, 22, 18, 14, 40, 14, 10, 8, 12, 11, 8, 14, 13, 14, 14, 11])

    # ── Sheet 3: Aggregated Products ──────────────────────────────────────────
    ws3 = wb.create_sheet("Aggregated Products")
    ws3["A1"] = "Aggregated Products -- grouped by description, sorted by total spend"
    ws3["A1"].font = title_font
    ws3.merge_cells("A1:H1")

    agg = _aggregate_products(results)
    if agg:
        AGG_COLS = list(agg[0].keys())
        _hdr_row(ws3, 2, AGG_COLS)
        for r, row_data in enumerate(agg, start=3):
            for c, key in enumerate(AGG_COLS, 1):
                ws3.cell(row=r, column=c, value=row_data.get(key))
        _col_widths(ws3, [42, 14, 8, 14, 18, 18, 45, 30])
    else:
        ws3.cell(row=2, column=1,
                 value="(no line items to aggregate)").font = Font(italic=True)

    # ── Sheet 4: Supplier Summary ─────────────────────────────────────────────
    ws4 = wb.create_sheet("Supplier Summary")
    ws4["A1"] = "Supplier Summary"
    ws4["A1"].font = title_font

    sup_rows = _supplier_summary(results)
    if sup_rows:
        SUP_COLS = list(sup_rows[0].keys())
        _hdr_row(ws4, 2, SUP_COLS)
        for r, row_data in enumerate(sup_rows, start=3):
            for c, key in enumerate(SUP_COLS, 1):
                ws4.cell(row=r, column=c, value=row_data.get(key))
        _col_widths(ws4, [30, 14, 18, 28, 55])

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
            print(f"           #{inv.invoice_number or '?'} | "
                  f"{inv.supplier or '?'} -> {inv.customer or '?'} | "
                  f"{tot} | {len(inv.line_items)} items")

    print(f"\nExcel    -> {output_xlsx}")
    print(f"Raw text -> {raw_text_path}")

    needs_review = [r for r in results if r.status != "OK"]
    if needs_review:
        print(f"\n{len(needs_review)} PDF(s) need review -- check 'Invoices' sheet.")


if __name__ == "__main__":
    main()
