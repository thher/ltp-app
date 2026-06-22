from __future__ import annotations

from typing import Optional

from app.database.db_manager import DatabaseManager
from app.database.models import Category


class CategoryRepository:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def save(self, category: Category) -> Category:
        with self.db.transaction():
            cursor = self.db.execute(
                """
                INSERT INTO categories (name, description, color, icon, parent_id, ai_keywords)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    category.name,
                    category.description,
                    category.color,
                    category.icon,
                    category.parent_id,
                    category.ai_keywords,
                ),
            )
            category.id = cursor.lastrowid
        return category

    def find_by_id(self, category_id: int) -> Optional[Category]:
        row = self.db.fetchone(
            "SELECT * FROM categories WHERE id = ?", (category_id,)
        )
        return self._row_to_model(row) if row else None

    def find_by_name(self, name: str) -> Optional[Category]:
        row = self.db.fetchone(
            "SELECT * FROM categories WHERE name = ?", (name,)
        )
        return self._row_to_model(row) if row else None

    def find_all(self) -> list[Category]:
        rows = self.db.fetchall("SELECT * FROM categories ORDER BY name")
        return [self._row_to_model(r) for r in rows]

    def update(self, category: Category) -> None:
        with self.db.transaction():
            self.db.execute(
                """
                UPDATE categories
                SET name = ?, description = ?, color = ?, icon = ?,
                    parent_id = ?, ai_keywords = ?
                WHERE id = ?
                """,
                (
                    category.name,
                    category.description,
                    category.color,
                    category.icon,
                    category.parent_id,
                    category.ai_keywords,
                    category.id,
                ),
            )

    def delete(self, category_id: int) -> None:
        with self.db.transaction():
            self.db.execute(
                "DELETE FROM categories WHERE id = ?", (category_id,)
            )

    def count(self) -> int:
        return self.db.fetchscalar("SELECT COUNT(*) FROM categories") or 0

    @staticmethod
    def _row_to_model(row) -> Category:
        return Category(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            color=row["color"],
            icon=row["icon"],
            parent_id=row["parent_id"],
            ai_keywords=row["ai_keywords"],
            created_at=row["created_at"],
        )
