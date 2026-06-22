"""Processing pipeline — Phase 2+ implementation."""
from __future__ import annotations

from pathlib import Path


class ProcessingPipeline:
    """Orchestrates PDF → DB for a single invoice file."""

    def run(self, pdf_path: Path) -> None:
        raise NotImplementedError("PDF processing implemented in Phase 2")

    def run_batch(self, pdf_paths: list[Path]) -> None:
        for path in pdf_paths:
            self.run(path)
