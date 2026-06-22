"""PDF report export using ReportLab Platypus."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.export.base_exporter import BaseExporter

# ── Palette ────────────────────────────────────────────────────────────────────
_NAVY  = colors.HexColor("#0F172A")
_BLUE  = colors.HexColor("#1E40AF")
_SKY   = colors.HexColor("#3B82F6")
_LIGHT = colors.HexColor("#F0F4F8")
_WHITE = colors.white
_GRAY  = colors.HexColor("#64748B")
_LGRAY = colors.HexColor("#E2E8F0")
_TEXT  = colors.HexColor("#1E293B")
_GREEN = colors.HexColor("#15803D")
_PEACH = colors.HexColor("#EA580C")

PAGE_W = A4[0] - 4 * cm  # usable width (2 cm margins each side)


class PDFReportExporter(BaseExporter):
    """Generates a formatted multi-page PDF report."""

    def export(self, data: dict, output_path: Path) -> Path:
        out = Path(output_path)
        if out.suffix != ".pdf":
            out = out.with_suffix(".pdf")

        doc = SimpleDocTemplate(
            str(out),
            pagesize=A4,
            leftMargin=2 * cm, rightMargin=2 * cm,
            topMargin=2 * cm,  bottomMargin=2 * cm,
            title="Invoice Summarizer Report",
            author="Invoice Summarizer",
        )
        st = _styles()
        story: list[Any] = []

        story += _cover(data, st)
        story.append(PageBreak())
        story += _executive_summary(data, st)
        story.append(PageBreak())
        story += _supplier_section(data, st)
        story.append(PageBreak())
        story += _material_section(data, st)
        story.append(PageBreak())
        story += _product_sections(data, st)

        doc.build(story)
        return out


# ── Style builder ─────────────────────────────────────────────────────────────

def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    defs = {
        "title": ParagraphStyle("RPTitle",    parent=base["Normal"],
                                fontSize=30, textColor=_NAVY, fontName="Helvetica-Bold",
                                alignment=TA_CENTER, spaceAfter=8),
        "subtitle": ParagraphStyle("RPSubtitle", parent=base["Normal"],
                                   fontSize=13, textColor=_GRAY, fontName="Helvetica",
                                   alignment=TA_CENTER, spaceAfter=4),
        "section": ParagraphStyle("RPSection",  parent=base["Normal"],
                                  fontSize=14, textColor=_NAVY, fontName="Helvetica-Bold",
                                  spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("RPBody",     parent=base["Normal"],
                               fontSize=9,  textColor=_TEXT, fontName="Helvetica",
                               spaceAfter=3),
        "caption": ParagraphStyle("RPCaption",  parent=base["Normal"],
                                  fontSize=7,  textColor=_GRAY, fontName="Helvetica",
                                  alignment=TA_CENTER, spaceAfter=2),
        "kpi_label": ParagraphStyle("RPKpiLbl", parent=base["Normal"],
                                    fontSize=9, textColor=_WHITE, fontName="Helvetica",
                                    alignment=TA_CENTER),
        "kpi_value": ParagraphStyle("RPKpiVal", parent=base["Normal"],
                                    fontSize=22, textColor=_WHITE, fontName="Helvetica-Bold",
                                    alignment=TA_CENTER),
        "filter": ParagraphStyle("RPFilter",   parent=base["Normal"],
                                 fontSize=8, textColor=_GRAY, fontName="Helvetica",
                                 alignment=TA_CENTER, spaceAfter=2),
    }
    return defs


# ── Cover page ────────────────────────────────────────────────────────────────

def _cover(data: dict, st: dict) -> list:
    filters = data.get("filters", {})
    ts = data.get("generated_at", datetime.now())

    story = [
        Spacer(1, 3 * cm),
        Paragraph("Invoice Summary Report", st["title"]),
        Spacer(1, 0.4 * cm),
        Paragraph(f"Generated {ts.strftime('%Y-%m-%d  %H:%M')}", st["subtitle"]),
        Spacer(1, 1.5 * cm),
        HRFlowable(width="100%", thickness=2, color=_BLUE, spaceAfter=12),
    ]

    # Filter summary as a compact table
    f_rows = [
        ["Date From", filters.get("date_from") or "All"],
        ["Date To",   filters.get("date_to")   or "All"],
        ["Material Category", filters.get("material_category") or "All"],
    ]
    if filters.get("supplier_id"):
        f_rows.insert(2, ["Supplier ID", str(filters["supplier_id"])])

    tbl = Table(f_rows, colWidths=[5 * cm, 8 * cm])
    tbl.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",  (0, 0), (-1, -1), 9),
        ("FONTNAME",  (0, 0), (0, -1),  "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1),  _NAVY),
        ("TEXTCOLOR", (1, 0), (1, -1),  _TEXT),
        ("ALIGN",     (0, 0), (0, -1),  "RIGHT"),
        ("ALIGN",     (1, 0), (1, -1),  "LEFT"),
        ("TOPPADDING",   (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, _LGRAY),
    ]))

    story.append(Paragraph("Report Filters", st["section"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(tbl)
    return story


# ── Executive summary ─────────────────────────────────────────────────────────

def _executive_summary(data: dict, st: dict) -> list:
    kpis = data.get("kpis", {})

    def _kpi_cell(label: str, value: str, color: colors.HexColor) -> Paragraph:
        return Paragraph(
            f"<font color='white' size='8'>{label}</font><br/>"
            f"<font color='white' size='20'><b>{value}</b></font>",
            ParagraphStyle("_kc", fontName="Helvetica", alignment=TA_CENTER, leading=22),
        )

    spend    = kpis.get("total_spend", 0) or 0
    avg_inv  = kpis.get("avg_invoice",  0) or 0
    n_inv    = kpis.get("invoice_count", 0) or 0
    n_sup    = kpis.get("active_suppliers", 0) or 0

    kpi_data = [[
        _kpi_cell("Active Suppliers", f"{int(n_sup):,}",          _BLUE),
        _kpi_cell("Total Invoices",   f"{int(n_inv):,}",          _SKY),
        _kpi_cell("Total Spend",      f"{float(spend):,.0f}",     _GREEN),
        _kpi_cell("Avg Invoice",      f"{float(avg_inv):,.0f}",   _PEACH),
    ]]

    kpi_w = PAGE_W / 4 - 0.2 * cm
    kpi_tbl = Table(kpi_data, colWidths=[kpi_w] * 4, rowHeights=[2.2 * cm])
    kpi_tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (0, 0), _BLUE),
        ("BACKGROUND",   (1, 0), (1, 0), _SKY),
        ("BACKGROUND",   (2, 0), (2, 0), _GREEN),
        ("BACKGROUND",   (3, 0), (3, 0), _PEACH),
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), [4]),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
        ("INNERGRID",    (0, 0), (-1, -1), 0, colors.white),
        ("BOX",          (0, 0), (-1, -1), 0, colors.white),
    ]))

    story = [
        Paragraph("Executive Summary", st["section"]),
        HRFlowable(width="100%", thickness=1, color=_LGRAY, spaceAfter=8),
        kpi_tbl,
        Spacer(1, 0.6 * cm),
    ]

    # Top 10 suppliers mini-table
    suppliers = sorted(
        data.get("suppliers", []),
        key=lambda r: r.get("total_spend", 0) or 0,
        reverse=True,
    )[:10]

    if suppliers:
        story.append(Paragraph("Top Suppliers by Spend", st["section"]))
        story.append(HRFlowable(width="100%", thickness=1, color=_LGRAY, spaceAfter=6))
        hdr = [["#", "Supplier", "Category", "Invoices", "Total Spend"]]
        body = [
            [str(i + 1),
             r.get("canonical_name", "—"),
             r.get("category_name", "—"),
             str(r.get("invoice_count", 0)),
             f"{r.get('total_spend', 0):,.0f}"]
            for i, r in enumerate(suppliers)
        ]
        story.append(_make_table(hdr + body, [1.2*cm, 7*cm, 4*cm, 2.2*cm, 3*cm]))

    return story


# ── Supplier section ──────────────────────────────────────────────────────────

def _supplier_section(data: dict, st: dict) -> list:
    suppliers = sorted(
        data.get("suppliers", []),
        key=lambda r: r.get("total_spend", 0) or 0,
        reverse=True,
    )

    story = [
        Paragraph("Supplier Summary", st["section"]),
        HRFlowable(width="100%", thickness=1, color=_LGRAY, spaceAfter=6),
    ]

    if not suppliers:
        story.append(Paragraph("No supplier data available.", st["body"]))
        return story

    hdr  = [["Supplier", "Category", "Country", "Invoices", "Total Spend"]]
    body = [
        [r.get("canonical_name", "—"),
         r.get("category_name", "—"),
         r.get("country") or "—",
         str(r.get("invoice_count", 0)),
         f"{r.get('total_spend', 0):,.0f}"]
        for r in suppliers
    ]
    story.append(_make_table(hdr + body, [7*cm, 4*cm, 2.5*cm, 2*cm, 3*cm]))
    story.append(Paragraph(f"Total: {len(suppliers)} supplier(s)", st["caption"]))
    return story


# ── Material section ──────────────────────────────────────────────────────────

def _material_section(data: dict, st: dict) -> list:
    cats = data.get("material_categories", [])

    story = [
        Paragraph("Material Category Breakdown", st["section"]),
        HRFlowable(width="100%", thickness=1, color=_LGRAY, spaceAfter=6),
    ]

    if not cats:
        story.append(Paragraph("No material data available.", st["body"]))
        return story

    hdr  = [["Category", "Unit Type", "Total Qty", "Total Spend", "Items"]]
    body = [
        [r.get("material_category", "—"),
         r.get("unit_type", "—"),
         f"{r.get('total_quantity', 0):,.1f}",
         f"{r.get('total_spend', 0):,.0f}",
         str(r.get("item_count", 0))]
        for r in cats
    ]
    story.append(_make_table(hdr + body, [5.5*cm, 3*cm, 3*cm, 3.5*cm, 2*cm]))
    return story


# ── Product sections ──────────────────────────────────────────────────────────

def _product_sections(data: dict, st: dict) -> list:
    products = data.get("products", [])

    by_spend = sorted(
        products,
        key=lambda r: r.get("total_spend", 0) or 0,
        reverse=True,
    )[:20]

    by_qty = sorted(
        [r for r in products if (r.get("total_quantity") or 0) > 0],
        key=lambda r: r.get("total_quantity", 0) or 0,
        reverse=True,
    )[:20]

    story = [Paragraph("Top Products by Spend", st["section"]),
             HRFlowable(width="100%", thickness=1, color=_LGRAY, spaceAfter=6)]

    if by_spend:
        hdr  = [["#", "Description", "Category", "Unit", "Total Spend", "Count"]]
        body = [
            [str(i + 1),
             _trunc(r.get("raw_description", "—"), 42),
             r.get("material_category", "—"),
             r.get("unit") or "—",
             f"{r.get('total_spend', 0):,.0f}",
             str(r.get("occurrences", 0))]
            for i, r in enumerate(by_spend)
        ]
        story.append(_make_table(hdr + body, [1*cm, 7.5*cm, 3.5*cm, 1.5*cm, 3*cm, 1.5*cm]))
    else:
        story.append(Paragraph("No product data available.", st["body"]))

    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph("Top Products by Quantity", st["section"]))
    story.append(HRFlowable(width="100%", thickness=1, color=_LGRAY, spaceAfter=6))

    if by_qty:
        hdr  = [["#", "Description", "Category", "Unit", "Total Qty", "Length (m)"]]
        body = [
            [str(i + 1),
             _trunc(r.get("raw_description", "—"), 42),
             r.get("material_category", "—"),
             r.get("unit") or "—",
             f"{r.get('total_quantity', 0):,.1f}",
             f"{r.get('total_length_m', 0) or 0:,.1f}"]
            for i, r in enumerate(by_qty)
        ]
        story.append(_make_table(hdr + body, [1*cm, 7.5*cm, 3.5*cm, 1.5*cm, 2.5*cm, 2*cm]))
    else:
        story.append(Paragraph("No quantity data available.", st["body"]))

    return story


# ── Table builder ─────────────────────────────────────────────────────────────

def _make_table(data: list[list[str]], col_widths: list[float]) -> Table:
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",    (0, 0), (-1, 0), _NAVY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), _WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 8),
        ("ALIGN",         (0, 0), (-1, 0), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        # Data rows
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [_WHITE, _LIGHT]),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("ALIGN",         (0, 1), (-1, -1), "LEFT"),
        # Right-align last two numeric columns
        ("ALIGN",         (-2, 1), (-1, -1), "RIGHT"),
        # Grid
        ("LINEBELOW",     (0, 0), (-1, -1), 0.5, _LGRAY),
        ("BOX",           (0, 0), (-1, -1), 0.5, _LGRAY),
    ]))
    return tbl


def _trunc(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n - 1] + "…"
