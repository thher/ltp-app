from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import ReviewQueueItem


class ReviewQueueRepository:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def save(self, item: ReviewQueueItem) -> ReviewQueueItem:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT INTO review_queue
                    (invoice_id, line_item_id, issue_type, description,
                     suggestion, resolved, resolution)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.invoice_id,
                    item.line_item_id,
                    item.issue_type,
                    item.description,
                    item.suggestion,
                    int(item.resolved),
                    item.resolution,
                ),
            )
            item.id = cursor.lastrowid
        return item

    def find_all(self) -> list[ReviewQueueItem]:
        rows = self.db.fetchall(
            "SELECT * FROM review_queue ORDER BY created_at DESC"
        )
        return [self._row_to_model(r) for r in rows]

    def find_unresolved(self) -> list[ReviewQueueItem]:
        rows = self.db.fetchall(
            "SELECT * FROM review_queue WHERE resolved = 0 ORDER BY created_at DESC"
        )
        return [self._row_to_model(r) for r in rows]

    def find_by_invoice(self, invoice_id: int) -> list[ReviewQueueItem]:
        rows = self.db.fetchall(
            "SELECT * FROM review_queue WHERE invoice_id = ?",
            (invoice_id,),
        )
        return [self._row_to_model(r) for r in rows]

    def delete_by_invoice(self, invoice_id: int) -> None:
        with self.db.transaction():
            self.db.execute(
                "DELETE FROM review_queue WHERE invoice_id = ?", (invoice_id,)
            )

    def resolve(self, item_id: int, resolution: str) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                UPDATE review_queue
                SET resolved = 1, resolution = ?,
                    resolved_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (resolution, item_id),
            )

    def count_unresolved(self) -> int:
        return self.db.fetchscalar(
            "SELECT COUNT(*) FROM review_queue WHERE resolved = 0"
        ) or 0

    @staticmethod
    def _row_to_model(row) -> ReviewQueueItem:
        return ReviewQueueItem(
            id=row["id"],
            invoice_id=row["invoice_id"],
            line_item_id=row["line_item_id"],
            issue_type=row["issue_type"],
            description=row["description"],
            suggestion=row["suggestion"],
            resolved=bool(row["resolved"]),
            resolution=row["resolution"],
            created_at=row["created_at"],
            resolved_at=row["resolved_at"],
        )
