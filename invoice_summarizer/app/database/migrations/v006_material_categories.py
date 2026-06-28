"""
Migration v006: Seed Norwegian building material categories.

Idempotent -- uses INSERT OR IGNORE so re-running is safe.
These categories align with the Product Normalizer service and the
spec categories: Trelast, Terrasse, Plater, Isolasjon, Dører og vinduer,
Beslag og festemidler, Tak, Rør, Elektrisk, Ventilasjon,
Maling og overflate, Verktøy, Transport og tjenester, Leieutstyr,
Diverse, Ukjent.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.db_manager import DatabaseManager

VERSION = "v006_material_categories"

_CATEGORIES = [
    {
        "name": "Trelast",
        "description": "Konstruksjonsvirke, plank, bord, lekter og stolper",
        "color": "#8B4513",
        "icon": "lumber",
        "keywords": ["trelast", "plank", "bord", "bjelke", "lekt", "stolpe",
                     "c24", "c14", "t3", "gl28", "48x", "36x", "45x", "konstruksjonsvirke"],
    },
    {
        "name": "Terrasse",
        "description": "Terrassebord, utebord og terrasse-produkter",
        "color": "#DEB887",
        "icon": "deck",
        "keywords": ["terrasse", "terrassebord", "utebord", "28x120", "28x145"],
    },
    {
        "name": "Plater",
        "description": "Gipsplater, OSB, kryssfinér, sponplater og kledning",
        "color": "#BC8F5F",
        "icon": "panels",
        "keywords": ["gips", "osb", "kryssfinér", "sponplat", "sperreplat",
                     "kledning", "panel", "gipsbord", "fjel", "lekt"],
    },
    {
        "name": "Isolasjon",
        "description": "Mineralull, steinull, glava, isover, leca og EPS",
        "color": "#FFD700",
        "icon": "insulation",
        "keywords": ["isolasjon", "glava", "isover", "rockwool", "mineralull",
                     "steinull", "leca", "eps", "xps", "isolasjonsplater"],
    },
    {
        "name": "Dører og vinduer",
        "description": "Dørblader, karmer, vinduer og spir",
        "color": "#4169E1",
        "icon": "door",
        "keywords": ["dør", "vindu", "dørblad", "karm", "spir", "balkongdør",
                     "ytterdør", "innerdør", "vindueskarm", "glassdør"],
    },
    {
        "name": "Beslag og festemidler",
        "description": "Skruer, spiker, bolt, beslag og klamrer",
        "color": "#A0A0A0",
        "icon": "hardware",
        "keywords": ["skrue", "spiker", "bolt", "nagel", "beslag", "klamme",
                     "festemiddel", "vinkelbeslag", "ankerbeslag", "stift",
                     "nylonplugg", "mutter", "underlagsskive"],
    },
    {
        "name": "Tak",
        "description": "Takstein, takpapp, undertak, membraner og nedløp",
        "color": "#2F4F4F",
        "icon": "roof",
        "keywords": ["tak", "takstein", "takpapp", "undertak", "membran",
                     "nedløp", "rennstein", "takbeslag", "taklekter", "takstol",
                     "takkledning"],
    },
    {
        "name": "Rør",
        "description": "VVS, rør, avløp og vannledninger",
        "color": "#4682B4",
        "icon": "pipe",
        "keywords": ["rør", "vvs", "avløp", "vann", "sanitær", "kum",
                     "ledning", "toalett", "servant", "vannledning"],
    },
    {
        "name": "Elektrisk",
        "description": "Kabler, sikringer, brytere og kontakter",
        "color": "#F0C040",
        "icon": "electric",
        "keywords": ["elektro", "kabel", "sikring", "bryter", "kontakt",
                     "strøm", "el-", "sikringsskap", "jordledning", "kurs"],
    },
    {
        "name": "Ventilasjon",
        "description": "Ventilasjonskanaler, avtrekk og varmegjenvinning",
        "color": "#87CEEB",
        "icon": "fan",
        "keywords": ["ventilasjon", "kanal", "avtrekk", "tilluft", "lufting",
                     "varmegjenvinning", "ventilasjonsaggregat"],
    },
    {
        "name": "Maling og overflate",
        "description": "Maling, lakk, beise, grunning og sparkel",
        "color": "#98FB98",
        "icon": "paint",
        "keywords": ["maling", "lakk", "grunning", "beise", "primer",
                     "impregner", "sparkel", "fugemasse", "overflatebehandling", "beis"],
    },
    {
        "name": "Verktøy",
        "description": "Verktøy, maskiner og utstyr",
        "color": "#CD853F",
        "icon": "tools",
        "keywords": ["verktøy", "drill", "sag", "maskin", "sliper", "fres", "sagblad"],
    },
    {
        "name": "Transport og tjenester",
        "description": "Frakt, transport, kranleie og andre tjenester",
        "color": "#FF6347",
        "icon": "truck",
        "keywords": ["transport", "frakt", "kjøring", "levering", "kranvogn",
                     "kranleie", "utkjøring", "budtjeneste"],
    },
    {
        "name": "Leieutstyr",
        "description": "Stillas, maskinleie og annet leieutstyr",
        "color": "#9370DB",
        "icon": "rental",
        "keywords": ["leie", "utleie", "stillas", "stillasvogn", "maskinleie", "leieutstyr"],
    },
    {
        "name": "Diverse",
        "description": "Andre produkter og tjenester som ikke passer i andre kategorier",
        "color": "#C0C0C0",
        "icon": "misc",
        "keywords": ["diverse", "annet", "diverse varer"],
    },
    {
        "name": "Ukjent",
        "description": "Ikke klassifisert — krever manuell gjennomgang",
        "color": "#808080",
        "icon": "unknown",
        "keywords": [],
    },
]


def up(db: "DatabaseManager") -> None:
    for cat in _CATEGORIES:
        db.execute(
            """
            INSERT OR IGNORE INTO categories (name, description, color, icon, ai_keywords)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                cat["name"],
                cat["description"],
                cat["color"],
                cat["icon"],
                json.dumps(cat["keywords"], ensure_ascii=False),
            ),
        )
