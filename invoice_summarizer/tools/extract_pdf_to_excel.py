"""
Standalone PDF-to-Excel extractor — no GUI, no Poppler required.

Renders PDF pages with PyMuPDF (fitz) and runs Tesseract OCR directly.

USAGE
-----
Multiple PDFs -> one Excel file (last argument is the output):

    cd invoice_summarizer
    python tools\\extract_pdf_to_excel.py "a.pdf" "b.pdf" "c.pdf" "d.pdf" "output.xlsx"

Folder of PDFs:

    python tools\\extract_pdf_to_excel.py --input-folder "C:\\PDFs" --output "output.xlsx"

Override Tesseract path:

    python tools\\extract_pdf_to_excel.py "invoice.pdf" "output.xlsx" ^
        --tesseract "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"

OUTPUTS
-------
  output.xlsx             4-sheet workbook:
                            Summary       — one row per PDF
                            All Invoices  — detailed fields per PDF
                            All Line Items — all extracted line items
                            Raw Text       — full OCR text per PDF
  output_raw_text.txt     raw OCR text for all PDFs concatenated (UTF-8)
"""
from __future__ import annotations

import os
import sys
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

    # Already on PATH?
    try:
        r = subprocess.run(["tesseract", "--version"], capture_output=True, timeout=5)
        if r.returncode == 0:
            import shutil
            return shutil.which("tesseract") or "tesseract"
    except Exception:
        pass

    # Windows known install paths
    if sys.platform == "win32":
        for candidate in _WINDOWS_TESSERACT_PATHS:
            if Path(candidate).is_file():
                return candidate
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
        print("  Tesseract executable not found.")
        if sys.platform == "win32":
            for p in _WINDOWS_TESSERACT_PATHS:
                print(f"    checked: {p}")
            print("  Install: https://github.com/UB-Mannheim/tesseract/wiki")
            print("  Or pass: --tesseract \"C:\\Program Files\\Tesseract-OCR\\tesseract.exe\"")
        return False, ""

    pytesseract.pytesseract.tesseract_cmd = tess_exe
    print(f"  Using Tesseract: {tess_exe}")

    # Add Tesseract directory to PATH so its DLLs load on Windows
    if sys.platform == "win32" and tess_exe != "tesseract":
        tess_dir = str(Path(tess_exe).parent)
        cur = os.environ.get("PATH", "")
        if tess_dir.lower() not in cur.lower():
            os.environ["PATH"] = tess_dir + os.pathsep + cur

    # Validate by running the exe directly
    try:
        r = subprocess.run([tess_exe, "--version"], capture_output=True, timeout=10)
        if r.returncode != 0:
            print(f"  Tesseract error: {r.stderr.decode(errors='replace').strip()}")
            return False, ""
        ver = (r.stdout or r.stderr).decode(errors="replace").splitlines()
        if ver:
            print(f"  Version: {ver[0].strip()}")
    except Exception as e:
        print(f"  Tesseract failed to run: {e}")
        return False, ""

    try:
        langs = pytesseract.get_languages(config="")
        lang = "nor+eng" if "nor" in langs else "eng"
    except Exception:
        lang = "eng"

    return True, lang


# ── PDF text layer extraction ─────────────────────────────────────────────────

def _extract_pdf_text(pdf_path: Path) -> tuple[str, list[str], str]:
    """Return (full_text, pages, method). pdfplumber → PyMuPDF."""
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


# ── OCR via PyMuPDF render + Tesseract (no Poppler needed) ───────────────────

def _ocr_pdf(pdf_path: Path, lang: str) -> tuple[str, list[str], list[int]]:
    """Render each PDF page with PyMuPDF at 300 DPI, OCR with Tesseract.

    No Poppler / pdf2image required.
    """
    try:
        import fitz
    except ImportError:
        print("  [OCR] PyMuPDF (fitz) not installed. Run: pip install PyMuPDF")
        return "", [], []

    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        print("  [OCR] pytesseract or Pillow not installed.")
        return "", [], []

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        print(f"  [OCR] Cannot open PDF: {e}")
        return "", [], []

    pages: list[str] = []
    char_counts: list[int] = []
    total = len(doc)

    # 300 DPI: fitz default is 72 DPI, so scale = 300/72
    mat = fitz.Matrix(300 / 72, 300 / 72)

    for page_num in range(total):
        print(f"  OCR page {page_num + 1}/{total} ...", end="", flush=True)
        try:
            page = doc[page_num]
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(img, lang=lang)
        except Exception as e:
            text = ""
            print(f" ERROR: {e}", end="")
        pages.append(text)
        char_counts.append(len(text))
        print(f" {len(text)} chars")

    doc.close()
    return "\n\n".join(pages), pages, char_counts


# ── Invoice header parsing ────────────────────────────────────────────────────

def _parse_header(text: str, filename: str = "") -> dict:
    try:
        from app.processing.invoice_parser import InvoiceParser
        result = InvoiceParser().parse(text, filename=filename)
        return {
            "supplier":       result.supplier_name.value or "",
            "invoice_number": result.invoice_number.value or "",
            "invoice_date":   str(result.invoice_date.value) if result.invoice_date.value else "",
            "due_date":       str(result.due_date.value) if result.due_date.value else "",
            "total":          result.total_amount.value,
            "currency":       result.currency.value or "NOK",
            "confidence":     result.overall_confidence,
        }
    except Exception:
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
                raw = m.group(1).replace("\xa0", "").replace(" ", "").replace(",", ".")
                try:
                    return float(raw)
                except ValueError:
                    pass
        return None

    supplier = _find([r"^From[:\s]+(.+)$", r"(?:Leverand[oø]r|Supplier)[:\s]+(.+)$"])
    inv_num  = _find([r"(?:Invoice\s*No|Fakturanummer|Invoice\s*Number)[:\s#]+(\S+)"])
    date     = _find([
        r"(?:Invoice\s*Date|Fakturadato|Fakturadatum)[:\s]+(\d{4}-\d{2}-\d{2})",
        r"(?:Date|Dato)[:\s]+(\d{4}-\d{2}-\d{2})",
        r"(\d{2}[./]\d{2}[./]\d{4})",
    ])
    total    = _find_amount([
        r"(?:Grand\s*Total|Totalt|Total\s*Amount|Bel[øo]p)[:\s]+([\d\s,.]+)",
        r"(?:Total)[:\s]+([\d\s,.]+)",
    ])
    cur_m    = re.search(r"\b(NOK|SEK|EUR|USD|GBP)\b", text, re.I)
    currency = cur_m.group(1).upper() if cur_m else "NOK"

    return {
        "supplier": supplier, "invoice_number": inv_num,
        "invoice_date": date, "due_date": "",
        "total": total, "currency": currency, "confidence": 0.0,
    }


# ── Spatial line item extraction ──────────────────────────────────────────────

def _extract_line_items(pdf_path: Path) -> list[dict]:
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
                "Description":    item.description,
                "Section":        item.section,
                "Quantity":       item.quantity,
                "Unit":           item.unit or "",
                "Unit Price":     item.unit_price,
                "Discount %":     item.discount_pct,
                "VAT %":          item.vat_pct,
                "Line Total":     item.line_total,
                "Length/unit m":  item.length_per_unit,
                "Total length m": item.total_length,
                "Material":       item.material_category.name if item.material_category else "",
                "Confidence":     round(item.confidence, 2),
                "Needs Review":   "yes" if item.needs_review else "",
            }
            for item in items
        ]
    except Exception as e:
        print(f"  [LineItems] {e}")
        return []


# ── Per-PDF result ────────────────────────────────────────────────────────────

@dataclass
class PDFResult:
    filename: str
    path: Path
    status: str = "OK"          # "OK" | "Needs Review" | "Failed"
    extraction_method: str = ""
    ocr_lang: str = ""
    page_char_counts: list[int] = field(default_factory=list)
    raw_text: str = ""
    supplier: str = ""
    invoice_number: str = ""
    invoice_date: str = ""
    due_date: str = ""
    total: float | None = None
    currency: str = "NOK"
    confidence: float = 0.0
    line_items: list[dict] = field(default_factory=list)
    error: str = ""


# ── Process one PDF ───────────────────────────────────────────────────────────

def _process_pdf(
    pdf_path: Path,
    ocr_available: bool,
    ocr_lang: str,
    index: int,
    total: int,
) -> PDFResult:
    result = PDFResult(filename=pdf_path.name, path=pdf_path)

    print(f"\n[{index}/{total}] {pdf_path.name}")

    # Step A: PDF text layer
    print("  Extracting PDF text layer ...")
    text, text_pages, method = _extract_pdf_text(pdf_path)
    result.extraction_method = method
    result.page_char_counts = [len(p) for p in text_pages]

    if text.strip():
        print(f"  Text layer: {method}, {len(text)} chars")
    else:
        print("  Text layer: empty")

    # Step B: OCR when text layer thin (< 200 chars)
    if len(text.strip()) < 200:
        if ocr_available:
            print("  Running Tesseract OCR (PyMuPDF render, no Poppler) ...")
            ocr_text, _, page_char_counts = _ocr_pdf(pdf_path, ocr_lang)
            if ocr_text.strip():
                text = ocr_text
                result.extraction_method = "tesseract_ocr"
                result.page_char_counts = page_char_counts
                print(f"  OCR total: {len(text)} chars")
            else:
                print("  OCR produced no text")
                result.extraction_method = "failed"
                result.status = "Needs Review"
        else:
            print("  No text layer and Tesseract not available")
            result.extraction_method = "failed"
            result.status = "Needs Review"

    result.raw_text = text

    # Step C: Parse header
    print("  Parsing invoice fields ...")
    header = _parse_header(text, filename=pdf_path.stem)
    result.supplier       = header.get("supplier") or ""
    result.invoice_number = header.get("invoice_number") or ""
    result.invoice_date   = header.get("invoice_date") or ""
    result.due_date       = header.get("due_date") or ""
    result.total          = header.get("total")
    result.currency       = header.get("currency") or "NOK"
    result.confidence     = header.get("confidence") or 0.0

    print(f"  Supplier : {result.supplier or '(not found)'}")
    print(f"  Invoice# : {result.invoice_number or '(not found)'}")
    print(f"  Date     : {result.invoice_date or '(not found)'}")
    print(f"  Total    : {result.total} {result.currency}")
    print(f"  Conf     : {result.confidence:.0%}")

    if not result.supplier and not result.invoice_number and not result.total:
        result.status = "Needs Review"

    # Step D: Line items
    print("  Extracting line items ...")
    result.line_items = _extract_line_items(pdf_path)
    print(f"  Line items: {len(result.line_items)}")

    return result


# ── Excel writer ──────────────────────────────────────────────────────────────

def _write_excel(output_path: Path, results: list[PDFResult]) -> None:
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter
    except ImportError:
        print("ERROR: openpyxl not installed. Run: pip install openpyxl")
        sys.exit(1)

    wb = openpyxl.Workbook()
    title_font  = Font(bold=True, size=13)
    hdr_font    = Font(bold=True)
    hdr_fill    = PatternFill("solid", fgColor="D9E1F2")
    warn_fill   = PatternFill("solid", fgColor="FFE0B2")
    fail_fill   = PatternFill("solid", fgColor="FFCDD2")
    ok_fill     = PatternFill("solid", fgColor="C8E6C9")
    mono_font   = Font(name="Courier New", size=9)

    def _set_col_widths(ws, widths: dict[str, int]) -> None:
        for col, w in widths.items():
            ws.column_dimensions[col].width = w

    def _header_row(ws, row: int, cols: list[str]) -> None:
        for c, label in enumerate(cols, 1):
            cell = ws.cell(row=row, column=c, value=label)
            cell.font = hdr_font
            cell.fill = hdr_fill

    def _status_fill(status: str) -> PatternFill:
        if status == "OK":
            return ok_fill
        if status == "Needs Review":
            return warn_fill
        return fail_fill

    # ── Sheet 1: Summary ──────────────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Summary"
    ws1["A1"] = f"PDF Extraction Report — {len(results)} file(s)"
    ws1["A1"].font = title_font
    ws1.merge_cells("A1:K1")
    ws1.row_dimensions[1].height = 22

    SUMMARY_COLS = [
        "File", "Status", "Supplier", "Invoice #", "Date", "Due Date",
        "Total", "Currency", "Method", "Text Chars", "Confidence", "Line Items",
    ]
    _header_row(ws1, 2, SUMMARY_COLS)

    for r, res in enumerate(results, start=3):
        vals = [
            res.filename,
            res.status,
            res.supplier or "(not found)",
            res.invoice_number or "(not found)",
            res.invoice_date or "(not found)",
            res.due_date or "",
            res.total,
            res.currency,
            res.extraction_method,
            len(res.raw_text),
            f"{res.confidence:.0%}" if res.confidence else "0%",
            len(res.line_items),
        ]
        fill = _status_fill(res.status)
        for c, val in enumerate(vals, 1):
            cell = ws1.cell(row=r, column=c, value=val)
            if c == 2:  # Status column gets colour
                cell.fill = fill

    _set_col_widths(ws1, {
        "A": 35, "B": 14, "C": 28, "D": 16, "E": 14, "F": 14,
        "G": 14, "H": 10, "I": 16, "J": 12, "K": 12, "L": 12,
    })

    # ── Sheet 2: All Invoices (one block per PDF) ─────────────────────────────
    ws2 = wb.create_sheet("All Invoices")
    ws2["A1"] = "All Invoices — Detailed"
    ws2["A1"].font = title_font
    ws2.merge_cells("A1:B1")
    cur_row = 3

    for res in results:
        fill = _status_fill(res.status)
        # File header
        cell = ws2.cell(row=cur_row, column=1, value=res.filename)
        cell.font = Font(bold=True, size=11)
        cell.fill = fill
        ws2.merge_cells(start_row=cur_row, start_column=1, end_row=cur_row, end_column=2)
        cur_row += 1

        detail_rows = [
            ("Status",             res.status),
            ("Supplier",           res.supplier or "(not found)"),
            ("Invoice Number",     res.invoice_number or "(not found)"),
            ("Invoice Date",       res.invoice_date or "(not found)"),
            ("Due Date",           res.due_date or "(not found)"),
            ("Total Amount",       res.total),
            ("Currency",           res.currency),
            ("Extraction Method",  res.extraction_method),
            ("Total Text Chars",   len(res.raw_text)),
            ("Parser Confidence",  f"{res.confidence:.0%}" if res.confidence else "0%"),
            ("Line Items Found",   len(res.line_items)),
            ("OCR chars per page", ", ".join(str(n) for n in res.page_char_counts) or "n/a"),
        ]
        if res.error:
            detail_rows.append(("Error", res.error))

        for label, value in detail_rows:
            ws2.cell(row=cur_row, column=1, value=label).font = hdr_font
            ws2.cell(row=cur_row, column=1).fill = hdr_fill
            ws2.cell(row=cur_row, column=2, value=value)
            cur_row += 1

        cur_row += 1  # blank separator

    _set_col_widths(ws2, {"A": 24, "B": 60})

    # ── Sheet 3: All Line Items ────────────────────────────────────────────────
    ws3 = wb.create_sheet("All Line Items")
    LINE_ITEM_COLS = [
        "Source File", "Invoice #",
        "Description", "Section", "Quantity", "Unit", "Unit Price",
        "Discount %", "VAT %", "Line Total",
        "Length/unit m", "Total length m", "Material", "Confidence", "Needs Review",
    ]
    _header_row(ws3, 1, LINE_ITEM_COLS)

    row = 2
    any_items = False
    for res in results:
        for item in res.line_items:
            any_items = True
            ws3.cell(row=row, column=1, value=res.filename)
            ws3.cell(row=row, column=2, value=res.invoice_number or "")
            for c, key in enumerate(LINE_ITEM_COLS[2:], start=3):
                ws3.cell(row=row, column=c, value=item.get(key))
            row += 1

    if not any_items:
        ws3.cell(row=2, column=1, value="(no line items extracted from any PDF)")
        ws3.cell(row=2, column=1).font = Font(italic=True)

    _set_col_widths(ws3, {
        "A": 30, "B": 16, "C": 40, "D": 14,
        "E": 10, "F": 8, "G": 12, "H": 12, "I": 8,
        "J": 14, "K": 14, "L": 14, "M": 16, "N": 12, "O": 12,
    })

    # ── Sheet 4: Raw Text ──────────────────────────────────────────────────────
    ws4 = wb.create_sheet("Raw Text")
    ws4["A1"] = "Raw OCR / extracted text — one section per PDF"
    ws4["A1"].font = title_font
    ws4.column_dimensions["A"].width = 130
    row = 3

    for res in results:
        # Section header
        sep = "=" * 70
        for line in [sep, f"FILE: {res.filename}", f"STATUS: {res.status}", sep]:
            cell = ws4.cell(row=row, column=1, value=line)
            cell.font = Font(bold=True, name="Courier New", size=9)
            row += 1

        text = res.raw_text or "(no text extracted)"
        for line in text.splitlines():
            ws4.cell(row=row, column=1, value=line).font = mono_font
            row += 1

        row += 2  # blank gap between PDFs

    wb.save(str(output_path))


# ── Arg parsing ───────────────────────────────────────────────────────────────

def _parse_args() -> tuple[list[Path], Path, str | None]:
    args = sys.argv[1:]
    tess_override: str | None = None
    input_folder: Path | None = None
    output_path: Path | None = None
    positional: list[str] = []

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

    # Collect PDF list
    if input_folder:
        if not input_folder.is_dir():
            print(f"ERROR: --input-folder not found: {input_folder}")
            sys.exit(1)
        pdfs = sorted(input_folder.glob("*.pdf")) + sorted(input_folder.glob("*.PDF"))
        if not pdfs:
            print(f"ERROR: No PDF files found in {input_folder}")
            sys.exit(1)
    elif positional:
        # Last positional arg is the output xlsx (if not already set via --output)
        if output_path is None:
            output_path = Path(positional.pop())
        pdfs = [Path(p) for p in positional]
    else:
        print(__doc__)
        print("ERROR: Provide PDF files or --input-folder.")
        sys.exit(1)

    if output_path is None:
        print("ERROR: Specify output file (last positional arg or --output <file>).")
        sys.exit(1)

    missing = [p for p in pdfs if not p.exists()]
    if missing:
        for m in missing:
            print(f"ERROR: PDF not found: {m}")
        sys.exit(1)

    return pdfs, output_path.resolve(), tess_override


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    pdfs, output_xlsx, tess_override = _parse_args()

    output_xlsx.parent.mkdir(parents=True, exist_ok=True)
    raw_text_path = output_xlsx.parent / (output_xlsx.stem + "_raw_text.txt")

    print(f"\n=== PDF Extractor ===")
    print(f"PDFs   : {len(pdfs)}")
    for p in pdfs:
        print(f"  {p}")
    print(f"Output : {output_xlsx}")
    print()

    # Tesseract setup (once for all PDFs)
    print("[Setup] Tesseract ...")
    ocr_available, ocr_lang = _setup_tesseract(tess_override)
    if ocr_available:
        print(f"  Language: {ocr_lang}")
    else:
        print("  Tesseract NOT available — PDF text layer only")
    print()

    # Process each PDF
    results: list[PDFResult] = []
    for idx, pdf_path in enumerate(pdfs, start=1):
        try:
            res = _process_pdf(pdf_path, ocr_available, ocr_lang, idx, len(pdfs))
        except Exception as exc:
            print(f"  FAILED: {exc}")
            res = PDFResult(
                filename=pdf_path.name,
                path=pdf_path,
                status="Failed",
                error=str(exc),
            )
        results.append(res)

    # Save raw text file
    all_text_parts = []
    for res in results:
        sep = "=" * 70
        all_text_parts.append(f"{sep}\nFILE: {res.filename}\n{sep}\n{res.raw_text}\n")
    raw_text_path.write_text("\n".join(all_text_parts), encoding="utf-8")

    # Write Excel
    print(f"\n[Writing] {output_xlsx} ...")
    _write_excel(output_xlsx, results)

    # Summary
    print(f"\n{'='*50}")
    print(f"Complete. {len(results)} PDF(s) processed.")
    print(f"{'='*50}")
    for res in results:
        flag = "[OK]          " if res.status == "OK" else \
               "[NEEDS REVIEW]" if res.status == "Needs Review" else "[FAILED]      "
        total_str = f"{res.total} {res.currency}" if res.total else "(not found)"
        print(f"  {flag} {res.filename}")
        print(f"             Supplier: {res.supplier or '(not found)'} | "
              f"Invoice#: {res.invoice_number or '(not found)'} | "
              f"Total: {total_str} | "
              f"Items: {len(res.line_items)}")

    print(f"\nExcel     -> {output_xlsx}")
    print(f"Raw text  -> {raw_text_path}")

    needs_review = [r for r in results if r.status != "OK"]
    if needs_review:
        print(f"\nWARNING: {len(needs_review)} PDF(s) need review.")
        print("  Open the Excel file -> 'Summary' sheet -> check Status column.")
        print("  Open 'Raw Text' sheet to see what text was actually read.")


if __name__ == "__main__":
    main()
