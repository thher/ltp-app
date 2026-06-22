"""
Standalone PDF-to-Excel extractor — no GUI required.

Usage:
    python tools/extract_pdf_to_excel.py "invoice.pdf" "output.xlsx"

Run from the invoice_summarizer/ directory:
    cd invoice_summarizer
    python tools/extract_pdf_to_excel.py "C:\\path\\to\\invoice.pdf" "output.xlsx"

Outputs:
  - output.xlsx          (Excel workbook: Summary + Line Items + Raw Text sheets)
  - output_raw_text.txt  (full OCR/extracted text, UTF-8)
"""
from __future__ import annotations

import sys
import os
from pathlib import Path

# Allow importing from app.* when run from invoice_summarizer/
_HERE = Path(__file__).resolve().parent
_ROOT = _HERE.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


# ── Tesseract Windows auto-detection ─────────────────────────────────────────

_WINDOWS_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def _find_tesseract_exe(override: str | None = None) -> str | None:
    """Return the path to tesseract.exe, or None if not found."""
    import subprocess

    # 1. Explicit override from --tesseract flag
    if override:
        p = Path(override)
        if p.is_file():
            return str(p)
        print(f"  WARNING: --tesseract path not found: {override}")

    # 2. Already on PATH
    try:
        r = subprocess.run(
            ["tesseract", "--version"], capture_output=True, timeout=5
        )
        if r.returncode == 0:
            import shutil
            found = shutil.which("tesseract")
            return found or "tesseract"
    except Exception:
        pass

    # 3. Windows well-known install directories
    if sys.platform == "win32":
        for candidate in _WINDOWS_TESSERACT_PATHS:
            if Path(candidate).is_file():
                return candidate

        local = os.environ.get("LOCALAPPDATA", "")
        if local:
            user_path = Path(local) / "Programs" / "Tesseract-OCR" / "tesseract.exe"
            if user_path.is_file():
                return str(user_path)

    return None


def _setup_tesseract(override: str | None = None) -> tuple[bool, str]:
    """Locate Tesseract, configure pytesseract, return (available, lang).

    On Windows, Tesseract must be on PATH *or* in a known install directory.
    Its DLLs are loaded from its own folder, so we add that directory to PATH
    before calling any pytesseract function.
    """
    try:
        import pytesseract
    except ImportError:
        print("  pytesseract not installed. Run: pip install pytesseract")
        return False, ""

    import subprocess

    tess_exe = _find_tesseract_exe(override)

    if tess_exe is None:
        print("  Tesseract executable not found.")
        if sys.platform == "win32":
            print("  Checked PATH and:")
            for p in _WINDOWS_TESSERACT_PATHS:
                print(f"    {p}")
            print("  Install from: https://github.com/UB-Mannheim/tesseract/wiki")
            print("  Or pass: --tesseract \"C:\\path\\to\\tesseract.exe\"")
        return False, ""

    # Point pytesseract at the executable
    pytesseract.pytesseract.tesseract_cmd = tess_exe
    print(f"  Using Tesseract: {tess_exe}")

    # Add the Tesseract directory to PATH so its DLLs are loadable on Windows
    if sys.platform == "win32" and tess_exe != "tesseract":
        tess_dir = str(Path(tess_exe).parent)
        current_path = os.environ.get("PATH", "")
        if tess_dir.lower() not in current_path.lower():
            os.environ["PATH"] = tess_dir + os.pathsep + current_path

    # Validate by running the exe directly (avoids pytesseract's own PATH reliance)
    try:
        r = subprocess.run(
            [tess_exe, "--version"], capture_output=True, timeout=10
        )
        if r.returncode != 0:
            err = r.stderr.decode(errors="replace").strip()
            print(f"  Tesseract returned error: {err}")
            return False, ""
        ver_line = (r.stdout or r.stderr).decode(errors="replace").splitlines()
        if ver_line:
            print(f"  Version: {ver_line[0].strip()}")
    except Exception as e:
        print(f"  Tesseract failed to run: {e}")
        return False, ""

    # Detect available languages
    try:
        langs = pytesseract.get_languages(config="")
        lang = "nor+eng" if "nor" in langs else "eng"
    except Exception:
        lang = "eng"

    return True, lang


# ── Text extraction (PDF text layer) ─────────────────────────────────────────

def _extract_pdf_text(pdf_path: Path) -> tuple[str, list[str], str]:
    """Return (full_text, pages, method). Tries pdfplumber then PyMuPDF."""
    # pdfplumber
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(str(pdf_path)) as pdf:
            for p in pdf.pages:
                pages.append(p.extract_text() or "")
        full = "\n\n".join(pages)
        if full.strip():
            return full, pages, "pdfplumber"
    except Exception:
        pass

    # PyMuPDF
    try:
        import fitz
        pages = []
        doc = fitz.open(str(pdf_path))
        for p in doc:
            pages.append(p.get_text())
        doc.close()
        full = "\n\n".join(pages)
        if full.strip():
            return full, pages, "pymupdf"
    except Exception:
        pass

    return "", [], "none"


# ── OCR extraction ────────────────────────────────────────────────────────────

def _ocr_pdf(pdf_path: Path, lang: str) -> tuple[str, list[str], list[int]]:
    """Return (full_text, pages, char_counts_per_page)."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        print("  [OCR] pytesseract or Pillow not installed — skipping OCR")
        return "", [], []

    try:
        from pdf2image import convert_from_path
    except ImportError:
        print("  [OCR] pdf2image not installed — skipping OCR")
        return "", [], []

    print(f"  Converting PDF to images (200 DPI) ...")
    try:
        images = convert_from_path(str(pdf_path), dpi=200)
    except Exception as e:
        print(f"  [OCR] convert_from_path failed: {e}")
        return "", [], []

    pages: list[str] = []
    char_counts: list[int] = []

    for i, img in enumerate(images, start=1):
        print(f"  OCR page {i}/{len(images)} ...", end="", flush=True)
        try:
            text = pytesseract.image_to_string(img, lang=lang)
        except Exception as e:
            text = ""
            print(f" ERROR: {e}", end="")
        pages.append(text)
        char_counts.append(len(text))
        print(f" {len(text)} chars")

    full = "\n\n".join(pages)
    return full, pages, char_counts


# ── Parse invoice header fields ───────────────────────────────────────────────

def _parse_header(text: str) -> dict:
    """Use app.processing.invoice_parser if available, else fallback regex."""
    try:
        from app.processing.invoice_parser import InvoiceParser
        result = InvoiceParser().parse(text)
        return {
            "supplier":       result.supplier_name.value or "",
            "invoice_number": result.invoice_number.value or "",
            "invoice_date":   str(result.invoice_date.value) if result.invoice_date.value else "",
            "due_date":       str(result.due_date.value) if result.due_date.value else "",
            "total":          result.total_amount.value,
            "currency":       result.currency.value or "NOK",
            "confidence":     result.overall_confidence,
        }
    except Exception as e:
        print(f"  [Parser] app parser unavailable ({e}), using fallback regex")
        return _parse_header_regex(text)


def _parse_header_regex(text: str) -> dict:
    import re

    def _find(patterns: list[str]) -> str:
        for pat in patterns:
            m = re.search(pat, text, re.I | re.M)
            if m:
                return m.group(1).strip()
        return ""

    def _find_amount(patterns: list[str]):
        for pat in patterns:
            m = re.search(pat, text, re.I | re.M)
            if m:
                raw = m.group(1).replace("\xa0", "").replace(" ", "")
                raw = raw.replace(",", ".")
                try:
                    return float(raw)
                except ValueError:
                    pass
        return None

    supplier = _find([
        r"^From[:\s]+(.+)$",
        r"(?:Leverand[oø]r|Supplier)[:\s]+(.+)$",
    ])

    inv_num = _find([
        r"(?:Invoice\s*No|Fakturanummer|Invoice\s*Number)[:\s#]+(\S+)",
        r"(?:INV|FAKT)[-\s]?(\w[\w\-]+)",
    ])

    date = _find([
        r"(?:Invoice\s*Date|Fakturadato|Fakturadatum)[:\s]+(\d{4}-\d{2}-\d{2})",
        r"(?:Date|Dato)[:\s]+(\d{4}-\d{2}-\d{2})",
        r"(\d{2}[./]\d{2}[./]\d{4})",
    ])

    total = _find_amount([
        r"(?:Grand\s*Total|Totalt|Total\s*Amount|Bel[øo]p)[:\s]+([\d\s,.]+)",
        r"(?:Total)[:\s]+([\d\s,.]+)",
    ])

    cur_m = re.search(r"\b(NOK|SEK|EUR|USD|GBP)\b", text, re.I)
    currency = cur_m.group(1).upper() if cur_m else "NOK"

    return {
        "supplier":       supplier,
        "invoice_number": inv_num,
        "invoice_date":   date,
        "due_date":       "",
        "total":          total,
        "currency":       currency,
        "confidence":     0.0,
    }


# ── Extract line items ────────────────────────────────────────────────────────

def _extract_line_items_ocr(pdf_path: Path, lang: str) -> list[dict]:
    """Spatial line item extraction via OCR word boxes."""
    try:
        from app.processing.ocr_engine import OcrEngine
        from app.processing.line_item_extractor import LineItemExtractor
        engine = OcrEngine()
        if not engine.is_available():
            return []
        ocr_pages = engine.extract_from_pdf(pdf_path)
        items = LineItemExtractor().extract_from_ocr(ocr_pages)
        return [
            {
                "Description":   item.description,
                "Section":       item.section,
                "Quantity":      item.quantity,
                "Unit":          item.unit or "",
                "Unit Price":    item.unit_price,
                "Discount %":    item.discount_pct,
                "VAT %":         item.vat_pct,
                "Line Total":    item.line_total,
                "Length/unit m": item.length_per_unit,
                "Total length m":item.total_length,
                "Material":      item.material_category.name if item.material_category else "",
                "Confidence":    round(item.confidence, 2),
                "Needs Review":  "yes" if item.needs_review else "",
            }
            for item in items
        ]
    except Exception as e:
        print(f"  [LineItems] extraction failed: {e}")
        return []


# ── Excel writer ──────────────────────────────────────────────────────────────

def _write_excel(
    output_path: Path,
    pdf_path: Path,
    header: dict,
    line_items: list[dict],
    raw_text: str,
    extraction_method: str,
    ocr_available: bool,
    ocr_lang: str,
    page_char_counts: list[int],
) -> None:
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        print("ERROR: openpyxl not installed. Run: pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.Workbook()

    # ── Sheet 1: Summary ──────────────────────────────────────────────────────
    ws = wb.active
    ws.title = "Summary"

    title_font = Font(bold=True, size=13)
    header_font = Font(bold=True)
    label_fill = PatternFill("solid", fgColor="D9E1F2")

    ws["A1"] = "Smart Invoice Summarizer — Extract Report"
    ws["A1"].font = title_font
    ws.merge_cells("A1:C1")
    ws.row_dimensions[1].height = 22

    rows = [
        ("Source PDF",          str(pdf_path)),
        ("Extraction method",   extraction_method),
        ("OCR available",       "yes" if ocr_available else "no"),
        ("OCR language",        ocr_lang or "n/a"),
        ("Total text chars",    len(raw_text)),
        ("Parser confidence",   f"{header['confidence']:.0%}" if header.get("confidence") else "n/a"),
        ("", ""),
        ("Supplier",            header.get("supplier") or "(not found)"),
        ("Invoice Number",      header.get("invoice_number") or "(not found)"),
        ("Invoice Date",        header.get("invoice_date") or "(not found)"),
        ("Due Date",            header.get("due_date") or "(not found)"),
        ("Total Amount",        header.get("total") or "(not found)"),
        ("Currency",            header.get("currency") or "NOK"),
        ("", ""),
        ("Line items found",    len(line_items)),
    ]

    if page_char_counts:
        rows.append(("", ""))
        rows.append(("OCR chars per page", ""))
        for i, n in enumerate(page_char_counts, 1):
            rows.append((f"  Page {i}", n))

    for i, (label, value) in enumerate(rows, start=3):
        ws.cell(row=i, column=1, value=label).font = header_font
        ws.cell(row=i, column=1).fill = label_fill
        ws.cell(row=i, column=2, value=value)

    ws.column_dimensions["A"].width = 24
    ws.column_dimensions["B"].width = 55

    # ── Sheet 2: Line Items ────────────────────────────────────────────────────
    ws2 = wb.create_sheet("Line Items")

    if line_items:
        col_keys = list(line_items[0].keys())
        for c, key in enumerate(col_keys, 1):
            cell = ws2.cell(row=1, column=c, value=key)
            cell.font = header_font
            cell.fill = label_fill

        for r, item in enumerate(line_items, start=2):
            for c, key in enumerate(col_keys, 1):
                ws2.cell(row=r, column=c, value=item.get(key))

        for c in range(1, len(col_keys) + 1):
            ws2.column_dimensions[
                openpyxl.utils.get_column_letter(c)
            ].width = 18
        ws2.column_dimensions["A"].width = 40  # Description
    else:
        ws2["A1"] = "(no line items extracted)"
        ws2["A1"].font = Font(italic=True)

    # ── Sheet 3: Raw Text ──────────────────────────────────────────────────────
    ws3 = wb.create_sheet("Raw Text")
    ws3["A1"] = "Full extracted text:"
    ws3["A1"].font = header_font
    ws3.column_dimensions["A"].width = 120
    mono = Font(name="Courier New", size=9)

    for i, line in enumerate(raw_text.splitlines(), start=2):
        cell = ws3.cell(row=i, column=1, value=line)
        cell.font = mono

    wb.save(str(output_path))


# ── Main ──────────────────────────────────────────────────────────────────────

def _parse_args() -> tuple[Path, Path, str | None]:
    """Parse argv: PDF OUTPUT [--tesseract PATH]"""
    args = sys.argv[1:]

    # Extract --tesseract value
    tess_override: str | None = None
    clean: list[str] = []
    i = 0
    while i < len(args):
        if args[i] == "--tesseract" and i + 1 < len(args):
            tess_override = args[i + 1]
            i += 2
        else:
            clean.append(args[i])
            i += 1

    if len(clean) < 2:
        print(__doc__)
        print("ERROR: Missing arguments.")
        print("Usage: python tools/extract_pdf_to_excel.py <PDF> <output.xlsx> [--tesseract PATH]")
        sys.exit(1)

    return Path(clean[0]).resolve(), Path(clean[1]).resolve(), tess_override


def main() -> None:
    pdf_path, output_xlsx, tess_override = _parse_args()

    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}")
        sys.exit(1)

    output_xlsx.parent.mkdir(parents=True, exist_ok=True)
    raw_text_path = output_xlsx.parent / (output_xlsx.stem + "_raw_text.txt")

    print(f"\n=== PDF Extractor ===")
    print(f"Input : {pdf_path}")
    print(f"Output: {output_xlsx}")
    print()

    # 1. Tesseract setup
    print("[1/5] Setting up Tesseract ...")
    ocr_available, ocr_lang = _setup_tesseract(tess_override)
    if ocr_available:
        print(f"  Language: {ocr_lang}")
    else:
        print("  Tesseract NOT available — will use PDF text layer only")

    # 2. Try PDF text layer
    print("[2/5] Extracting PDF text layer ...")
    full_text, text_pages, text_method = _extract_pdf_text(pdf_path)
    page_char_counts: list[int] = []
    extraction_method = text_method

    if full_text.strip():
        print(f"  Method: {text_method}, {len(full_text)} chars total")
        for i, p in enumerate(text_pages, 1):
            print(f"  Page {i}: {len(p)} chars")
    else:
        print("  No text in PDF layer")

    # 3. OCR when text layer is empty/thin (< 200 chars)
    if len(full_text.strip()) < 200:
        if ocr_available:
            print("[3/5] Running Tesseract OCR (PDF text layer empty) ...")
            ocr_text, _ocr_pages, page_char_counts = _ocr_pdf(pdf_path, ocr_lang)
            if ocr_text.strip():
                full_text = ocr_text
                extraction_method = "tesseract_ocr"
                print(f"  OCR complete: {len(full_text)} chars total")
            else:
                print("  OCR produced no text")
                extraction_method = "failed"
        else:
            print("[3/5] PDF text layer empty and Tesseract not available — no text to parse")
            extraction_method = "failed"
    else:
        print("[3/5] Skipping OCR (PDF text layer has sufficient text)")
        page_char_counts = [len(p) for p in text_pages]

    # 4. Parse header + line items
    print("[4/5] Parsing invoice fields ...")
    header = _parse_header(full_text)
    print(f"  Supplier      : {header['supplier'] or '(not found)'}")
    print(f"  Invoice Number: {header['invoice_number'] or '(not found)'}")
    print(f"  Invoice Date  : {header['invoice_date'] or '(not found)'}")
    print(f"  Total         : {header['total']} {header['currency']}")
    if header.get("confidence"):
        print(f"  Confidence    : {header['confidence']:.0%}")

    print("  Extracting line items ...")
    line_items = _extract_line_items_ocr(pdf_path, ocr_lang)
    print(f"  Line items found: {len(line_items)}")

    # 5. Save outputs
    print("[5/5] Saving outputs ...")

    raw_text_path.write_text(full_text, encoding="utf-8")
    print(f"  Raw text -> {raw_text_path}")

    _write_excel(
        output_path=output_xlsx,
        pdf_path=pdf_path,
        header=header,
        line_items=line_items,
        raw_text=full_text,
        extraction_method=extraction_method,
        ocr_available=ocr_available,
        ocr_lang=ocr_lang,
        page_char_counts=page_char_counts,
    )
    print(f"  Excel  -> {output_xlsx}")

    print()
    print("Done.")
    if not header["supplier"] and not header["invoice_number"] and not header["total"]:
        print()
        print("WARNING: No invoice fields were extracted.")
        print("  Check the raw text file to see what was read from the PDF:")
        print(f"  {raw_text_path}")


if __name__ == "__main__":
    main()
