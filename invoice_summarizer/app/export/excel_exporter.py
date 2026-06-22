"""Excel export — Phase 6 implementation."""
from pathlib import Path
from app.export.base_exporter import BaseExporter


class ExcelExporter(BaseExporter):
    def export(self, data: dict, output_path: Path) -> Path:
        raise NotImplementedError("Excel export implemented in Phase 6")
