"""Safe file operations — copy-on-import, never modify originals."""
from pathlib import Path


class FileManager:
    def copy_for_import(self, source: Path) -> Path:
        raise NotImplementedError("File management implemented in Phase 2")

    def compute_hash(self, path: Path) -> str:
        raise NotImplementedError("File management implemented in Phase 2")
