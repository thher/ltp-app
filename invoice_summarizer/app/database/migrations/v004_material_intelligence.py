"""Migration v004: Add material intelligence fields to line_items.

- unit_type           TEXT  — canonical unit type ('pcs', 'm', 'm²', 'm³', 'kg', ...)
- normalized_quantity REAL  — quantity expressed in the canonical unit
                              (for bundle items this is total_length, not piece count)
- material_category   TEXT  — product classification ('Timber', 'Decking', 'Doors', ...)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

VERSION = "v004_material_intelligence"


def up(db: "DatabaseManager") -> None:
    db.execute("ALTER TABLE line_items ADD COLUMN unit_type           TEXT")
    db.execute("ALTER TABLE line_items ADD COLUMN normalized_quantity REAL")
    db.execute("ALTER TABLE line_items ADD COLUMN material_category   TEXT")
