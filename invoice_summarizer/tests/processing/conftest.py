"""Fixtures for processing layer tests — generates minimal sample PDFs."""
import pytest

# Safe check — pdfplumber may crash at import on broken C-extension deps
try:
    import pdfplumber as _pdfplumber  # noqa: F401
    PDFPLUMBER_OK = True
except BaseException:
    PDFPLUMBER_OK = False

requires_pdfplumber = pytest.mark.skipif(
    not PDFPLUMBER_OK, reason="pdfplumber not available or broken"
)

try:
    import pytesseract as _pytesseract  # noqa: F401
    _pytesseract.get_tesseract_version()
    PYTESSERACT_OK = True
except Exception:
    PYTESSERACT_OK = False

requires_pytesseract = pytest.mark.skipif(
    not PYTESSERACT_OK, reason="pytesseract / tesseract not available"
)

# ── PDF generators ─────────────────────────────────────────────────────────────

def _make_pdf_bytes(text: str) -> bytes:
    """Return a minimal valid PDF embedding *text* using reportlab."""
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    y = 750
    for line in text.split("\n"):
        c.drawString(50, y, line)
        y -= 15
        if y < 50:
            c.showPage()
            y = 750
    c.save()
    return buf.getvalue()


@pytest.fixture()
def english_invoice_pdf(tmp_path):
    """A minimal English invoice PDF."""
    content = (
        "Acme Corporation Ltd\n"
        "123 Business Street\n"
        "London, UK\n"
        "\n"
        "Invoice No: INV-2024-0042\n"
        "Invoice Date: 2024-03-15\n"
        "Due Date: 2024-04-15\n"
        "\n"
        "Description          Amount\n"
        "Consulting services  12000.00\n"
        "\n"
        "Total Amount: 12000.00 GBP\n"
    )
    p = tmp_path / "english_invoice.pdf"
    p.write_bytes(_make_pdf_bytes(content))
    return p


@pytest.fixture()
def swedish_invoice_pdf(tmp_path):
    """A minimal Swedish invoice PDF."""
    content = (
        "Teknik AB\n"
        "Storgatan 5\n"
        "Stockholm\n"
        "\n"
        "Fakturanummer: FAKT-2024-0099\n"
        "Fakturadatum: 2024-05-10\n"
        "Förfallodatum: 2024-06-10\n"
        "\n"
        "Tjänst              Belopp\n"
        "IT-konsulttjänster  45 000,00\n"
        "\n"
        "Totalt: 45 000,00 SEK\n"
    )
    p = tmp_path / "swedish_invoice.pdf"
    p.write_bytes(_make_pdf_bytes(content))
    return p


@pytest.fixture()
def empty_pdf(tmp_path):
    """A PDF with no readable text (blank page)."""
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.showPage()
    c.save()
    p = tmp_path / "empty.pdf"
    p.write_bytes(buf.getvalue())
    return p
