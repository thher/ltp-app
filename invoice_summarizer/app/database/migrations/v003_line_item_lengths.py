"""Migration v003: Add per-piece length fields to line_items.

- length_per_unit  REAL — metres per piece, parsed from "N stk a L.L" prefix
- total_length     REAL — piece_count × length_per_unit (computed at import time)

Used for timber, mouldings, terrace boards, and similar linear products where
aggregation by running metres is more meaningful than piece count.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

VERSION = "v003_line_item_lengths"


def up(db: "DatabaseManager") -> None:
    db.execute("ALTER TABLE line_items ADD COLUMN length_per_unit REAL")
    db.execute("ALTER TABLE line_items ADD COLUMN total_length    REAL")
