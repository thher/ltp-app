"""Material category classification from product description keywords.

Rules are evaluated in priority order; the first matching keyword wins.
Categories higher in the list beat more generic ones below.
"""
from __future__ import annotations

from enum import Enum


class MaterialCategory(str, Enum):
    TIMBER     = "Timber"
    DECKING    = "Decking"
    INSULATION = "Insulation"
    DRYWALL    = "Drywall"
    DOORS      = "Doors"
    WINDOWS    = "Windows"
    TRIM       = "Trim/Mouldings"
    FASTENERS  = "Fasteners"
    PAINT      = "Paint"
    CONCRETE   = "Concrete"
    ROOFING    = "Roofing"
    HARDWARE   = "Hardware"
    TRANSPORT  = "Transport"
    OTHER      = "Other"


# (category, [lowercased_substring_keywords]) — first match wins
_RULES: list[tuple[MaterialCategory, list[str]]] = [
    (MaterialCategory.TRANSPORT, [
        "transport", "kranbil", "frakt", "emballasje", "embalasje",
        "pall og emb", "inng frakt",
    ]),
    (MaterialCategory.DECKING, [
        "terrassebord", "fast dekk kappe", "fast deck kappe",
        "terrasseskruer", "dekklist",
    ]),
    (MaterialCategory.INSULATION, [
        "glava", "a-plate", "a-matte", "rw a-pl", "rockwool",
        "halotex", "jackon", "vindsp",
    ]),
    (MaterialCategory.DRYWALL, [
        "gipspl", "skjøtebånd gips",
    ]),
    (MaterialCategory.DOORS, [
        "base 1 dør", "base 1 90x",
        "base 1 sd", "dempelist og terskel", "skyvedør",
        "yd fjell", "yd sf s-1", "tilsettning dørsett",
        "0500-n tilsett", "drsett",
    ]),
    (MaterialCategory.WINDOWS, [
        "vindu", "yd sola", "yd 11x",
    ]),
    (MaterialCategory.TRIM, [
        "feielist", "gulv/dørlist", "glattkant", "overgangslist",
        "trappelist", "18mm limtrefor", "limtrefor",
        "tilsetning malt", "foring dør", "hvitmalt karm",
        "0500-y hvitmalt", "karm med", "12x56 glattkant",
        "12x058 glattkant", "12x58 gulv",
    ]),
    (MaterialCategory.FASTENERS, [
        "skrue", "stift", "maskeringstape", "tape",
        "seal n bond", "fugeskum", "festeskive",
        "fast deck tool", "fast utv skruer",
    ]),
    (MaterialCategory.PAINT, [
        "maling", "lyssand flikk", "glattemiddel",
    ]),
    (MaterialCategory.HARDWARE, [
        "habo", "beslag", "miami dørvrider", "dørvrider", "dørpropp",
        "sylindersett", "skyvedørsring", "flexit", "hilaluke", "stifthammer",
        "byggtørker", "låse kasse",
    ]),
    (MaterialCategory.TIMBER, [
        "lekter", "impregnert", "df tett", "19x148",
        "48x148", "48x73", "48x48", "36x48", "30x48",
    ]),
    (MaterialCategory.ROOFING, ["tak", "papp"]),
    (MaterialCategory.CONCRETE, ["betong", "mørtel", "grus", "salt"]),
]


def classify_material(description: str) -> MaterialCategory:
    """Return the material category that best matches *description*."""
    desc_lower = description.lower()
    for category, keywords in _RULES:
        for kw in keywords:
            if kw in desc_lower:
                return category
    return MaterialCategory.OTHER
