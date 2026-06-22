"""
Demo data generator.
Creates 6 categories, 20 suppliers, and realistic invoice statistics.
All operations are idempotent — safe to call multiple times.
"""
from __future__ import annotations

import random
from datetime import date, timedelta

from app.database.db_manager import DatabaseManager
from app.database.models import Category, Invoice, Supplier, SupplierAlias
from app.database.repositories import (
    CategoryRepository,
    InvoiceRepository,
    SupplierRepository,
)

_CATEGORIES: list[dict] = [
    {"name": "Auto Parts",              "color": "#f38ba8", "description": "Automotive parts, oils, and accessories"},
    {"name": "Office Supplies",         "color": "#89b4fa", "description": "Stationery, paper, and office consumables"},
    {"name": "IT Equipment",            "color": "#a6e3a1", "description": "Computers, peripherals, and software"},
    {"name": "Facilities",              "color": "#fab387", "description": "Cleaning, maintenance, and facility management"},
    {"name": "Professional Services",   "color": "#cba6f7", "description": "Consulting, audit, and staffing services"},
    {"name": "Raw Materials",           "color": "#f9e2af", "description": "Industrial components and raw stock"},
]

# (name, category, country, [invoice totals in SEK])
_SUPPLIERS: list[tuple] = [
    ("Biltema",           "Auto Parts",             "SE", [850, 1200, 650, 2100, 780, 950, 1450, 680, 1100, 830, 1270, 920]),
    ("Mekonomen",         "Auto Parts",             "SE", [1800, 2400, 1650, 3200, 1950, 2750, 1200, 2100]),
    ("AutoTech AB",       "Auto Parts",             "SE", [4500, 2800, 6200, 3100, 5500]),
    ("Staples",           "Office Supplies",        "SE", [320, 450, 280, 510, 390, 260, 480, 350, 420, 290, 375, 440, 310, 495, 360]),
    ("Lyreco",            "Office Supplies",        "SE", [580, 720, 650, 490, 830, 670, 540, 760, 610, 700]),
    ("Viking Direct",     "Office Supplies",        "SE", [280, 340, 250, 410, 300, 380, 290]),
    ("PaperMate Nordic",  "Office Supplies",        "SE", [180, 240, 210, 195, 225, 260]),
    ("Dustin",            "IT Equipment",           "SE", [8500, 12400, 6800, 15200, 9300, 7600]),
    ("NetOnNet",          "IT Equipment",           "SE", [6200, 8900, 5400, 11200]),
    ("Elgiganten",        "IT Equipment",           "SE", [14500, 9800, 18200]),
    ("TechZone Nordic",   "IT Equipment",           "SE", [3800, 5200, 4100, 6500, 3300]),
    ("ISS Facility",      "Facilities",             "SE", [15000, 18500, 12000, 21000, 14500, 16800, 13200, 19500, 11500, 17200, 15800, 20100]),
    ("Sodexo",            "Facilities",             "SE", [22000, 28500, 19000, 25800, 21500, 24200, 18800, 27000]),
    ("CleanPro AB",       "Facilities",             "SE", [4500, 5800, 3900, 6200, 4100, 5100, 4800]),
    ("Deloitte",          "Professional Services",  "SE", [45000, 62000, 38000, 55000]),
    ("PwC",               "Professional Services",  "SE", [52000, 68000, 41000]),
    ("Addecco",           "Professional Services",  "SE", [18000, 22500, 15800, 21000, 19500, 16200]),
    ("Würth",             "Raw Materials",          "SE", [3200, 4500, 2800, 5100, 3600, 2900, 4200, 3800, 4900]),
    ("SKF",               "Raw Materials",          "SE", [8900, 12400, 7600, 10800, 9500]),
    ("Assa Abloy",        "Raw Materials",          "SE", [5400, 7200, 4800, 6600]),
]

_SEED_TAG = "[DEMO]"   # prefix on copy_path to identify generated records


class SeedDataGenerator:
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db
        self._cat_repo = CategoryRepository(db)
        self._sup_repo = SupplierRepository(db)
        self._inv_repo = InvoiceRepository(db)

    # ── Public API ─────────────────────────────────────────────────────

    def generate(self) -> dict:
        """
        Insert demo categories, suppliers, and invoices.
        Idempotent — skips records that already exist.
        Returns counts of new records created.
        """
        rng = random.Random(42)
        cat_ids = self._insert_categories()
        sup_ids = self._insert_suppliers(cat_ids)
        inv_count = self._insert_invoices(sup_ids, rng)
        return {
            "categories": len(cat_ids),
            "suppliers":  len(sup_ids),
            "invoices":   inv_count,
        }

    def clear(self) -> None:
        """Remove all demo-generated invoices (identified by copy_path prefix)."""
        with self.db.transaction():
            self.db.execute(
                "DELETE FROM invoices WHERE copy_path LIKE ?",
                (f"{_SEED_TAG}%",),
            )

    # ── Private ────────────────────────────────────────────────────────

    def _insert_categories(self) -> dict[str, int]:
        cat_ids: dict[str, int] = {}
        for data in _CATEGORIES:
            existing = self._cat_repo.find_by_name(data["name"])
            if existing:
                cat_ids[data["name"]] = existing.id
            else:
                cat = self._cat_repo.save(
                    Category(
                        name=data["name"],
                        description=data.get("description"),
                        color=data["color"],
                    )
                )
                cat_ids[data["name"]] = cat.id
        return cat_ids

    def _insert_suppliers(self, cat_ids: dict[str, int]) -> dict[str, int]:
        sup_ids: dict[str, int] = {}
        for name, cat_name, country, _ in _SUPPLIERS:
            norm_key = name.lower().replace(" ", "_").replace("ü", "u").replace("é", "e")
            existing = self._sup_repo.find_by_normalized_key(norm_key)
            if existing:
                sup_ids[name] = existing.id
            else:
                sup = self._sup_repo.save(
                    Supplier(
                        canonical_name=name,
                        normalized_key=norm_key,
                        category_id=cat_ids.get(cat_name),
                        country=country,
                    )
                )
                self._sup_repo.add_alias(
                    SupplierAlias(
                        supplier_id=sup.id,
                        alias=name.upper(),
                        source="demo",
                        confidence=1.0,
                    )
                )
                sup_ids[name] = sup.id
        return sup_ids

    def _insert_invoices(self, sup_ids: dict[str, int], rng: random.Random) -> int:
        today = date.today()
        created = 0
        inv_idx = 0
        for name, _, _, totals in _SUPPLIERS:
            sup_id = sup_ids.get(name)
            if sup_id is None:
                continue
            for i, total in enumerate(totals):
                norm = name.lower().replace(" ", "_").replace("ü", "u")
                file_hash = f"demo_{norm}_{i:04d}"
                copy_path = f"{_SEED_TAG}/copies/{norm}_{i:04d}.pdf"
                # Skip if already exists
                if self._inv_repo.find_by_hash(file_hash):
                    continue
                days_back = rng.randint(7, 730)
                inv_date = today - timedelta(days=days_back)
                due_date = inv_date + timedelta(days=30)
                vat = round(total * 0.25, 2)
                self._inv_repo.save(
                    Invoice(
                        supplier_id=sup_id,
                        invoice_number=f"INV-{inv_idx + 1:05d}",
                        invoice_date=inv_date,
                        due_date=due_date,
                        currency="SEK",
                        subtotal=total,
                        vat_total=vat,
                        grand_total=round(total + vat, 2),
                        original_path=f"[DEMO] {name} Invoice #{i + 1}",
                        copy_path=copy_path,
                        file_hash=file_hash,
                        status="processed",
                    )
                )
                created += 1
                inv_idx += 1
        return created
