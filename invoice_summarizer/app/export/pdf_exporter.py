"""PDF report export — Phase 6 implementation."""
from pathlib import Path
from app.export.base_exporter import BaseExporter


class PDFReportExporter(BaseExporter):
    """
    Generates a formatted PDF report using ReportLab.
    Planned output: supplier summary, category breakdown, top spend analysis.
    """

    def export(self, data: dict, output_path: Path) -> Path:
        raise NotImplementedError("PDF report export implemented in Phase 6")
