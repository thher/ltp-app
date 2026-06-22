"""Abstract base class for all exporters."""
from abc import ABC, abstractmethod
from pathlib import Path


class BaseExporter(ABC):
    @abstractmethod
    def export(self, data: dict, output_path: Path) -> Path:
        """Export data and return the path of the created file."""
