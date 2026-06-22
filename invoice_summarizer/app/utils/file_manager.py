"""Safe file operations — copy-on-import, never modify originals."""
from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path

from app.config import config


class FileManager:
    """Manages PDF copies in structured storage.

    All work is done on copies. Original files are never opened for writing
    and never deleted.
    """

    def __init__(self, copies_dir: Path | None = None) -> None:
        self._copies_dir = copies_dir or config.COPIES_DIR

    def compute_hash(self, path: Path) -> str:
        """Return SHA256 hex digest of *path*."""
        h = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def copy_for_import(self, source: Path) -> Path:
        """Copy *source* into managed storage and return the copy path.

        Layout: copies_dir / YYYY / MM / <uuid><ext>
        The original file is never touched.
        """
        from datetime import datetime

        now = datetime.now()
        dest_dir = self._copies_dir / str(now.year) / f"{now.month:02d}"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{uuid.uuid4().hex}{source.suffix.lower()}"
        shutil.copy2(source, dest)
        return dest
