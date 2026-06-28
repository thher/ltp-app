"""
Product normalization service — shared between the GUI pipeline and the
standalone CLI extractor.

Provides:
  normalize_key(description)    -> lowercase grouping key (noise stripped)
  canonical_name(description)   -> clean display name
  normalize_unit(unit)          -> canonical unit string
  detect_category(norm_key)     -> Norwegian category name
  extract_dimension(norm_key)   -> dimension string (e.g. "48x198") or ""

  ProductNormalizerService      -> DB-backed resolver that finds or creates
                                   Product records and supports learning via
                                   ProductAlias.

Noise words stripped before grouping:
  UH / UHØVLET / JUST / JUSTERT   -- surface-finish descriptors
  MM / MOELVEN                     -- manufacturer branding

Dimension notation normalised: 48X198 / 48 x 198 / 48×198 -> 48x198
Structural grades: C24, C14, T3, GL28c (preserved as-is in canonical name)
"""
from __future__ import annotations

import re
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from app.database.repositories.product_repo import ProductRepository
    from app.database.models import Product


# ── Regex patterns ────────────────────────────────────────────────────────────

_DIM_RE = re.compile(r'(\d+)\s*[xX×]\s*(\d+)')

_GRADE_RE = re.compile(r'\b(C\d+|T\d+|GL\d+[Ccs]?)\b', re.I)

_NOISE_RE = re.compile(
    r'\b(?:UH|UHØVLET|JUST|JUSTERT|MM|MOELVEN)\b\.?',
    re.I,
)

# Generic product-type suffixes: stripped from the grouping key so that
# "28X120 ROYAL TERRASSEBORD" and "28X120 MOELVEN ROYAL" share the same key,
# but kept in canonical_name() so the display label stays descriptive.
_TYPE_NOISE_RE = re.compile(
    r'\b(?:TERRASSEBORD|KLEDNINGSBORD|TRELAST)\b',
    re.I,
)

# ── Unit canonical map ────────────────────────────────────────────────────────

_UNIT_CANON: dict[str, str] = {
    "lm": "lm", "lpm": "lm", "m": "lm", "meter": "lm", "metre": "lm",
    "stk": "stk", "stk.": "stk", "pcs": "stk",
    "m2": "m2", "m²": "m2", "kvm": "m2",
    "m3": "m3", "m³": "m3",
    "kg": "kg", "l": "l", "liter": "l",
    "pk": "pk", "pall": "pall", "rll": "rll", "bx": "bx",
}

# ── Category detection patterns (priority-ordered) ────────────────────────────

_IS_RENTAL      = re.compile(r'\bleie\b|\butleie\b|\bstillasleie\b|\bstillas\b', re.I)
_IS_TRANSPORT   = re.compile(
    r'\btransport\b|\bfrakt\b|\bkj[øo]ring\b|\blevering\b|\bkranvogn?\b', re.I)
_IS_TOOLS       = re.compile(r'verkt[øo]y|\bdrill\b|\bsagblad\b|\bmaskinleie\b', re.I)
_IS_ELECTRICAL  = re.compile(r'\belektro|\bkabel\b|\bsikringsskap\b|\bbryter\b|\bkontaktdos', re.I)
_IS_PLUMBING    = re.compile(r'\bvvs\b|\bavl[øo]p\b|\bvannledning\b|\btoalett\b|\bservant\b', re.I)
_IS_VENTILATION = re.compile(r'ventil(?:asjon)?|avtrekk|tillufts?|lufting|varmegjenvinning', re.I)
_IS_PAINT       = re.compile(
    r'maling|lakk\b|grunning|beise\b|primer\b|sparkel|impregner|overflatebehandl', re.I)
_IS_DOOR_WIN    = re.compile(r'd[øo]r|vindu|dørblad|karm\b|\bspir\b', re.I)
_IS_INSULATION  = re.compile(
    r'isolasj|glava|isover|rockwool|mineralull|steinull|leca\b', re.I)
_IS_TERRACE     = re.compile(r'terrassebord|terrasse', re.I)
_IS_ROOFING     = re.compile(
    r'takstein|takpapp|taklekter|takkledning|takbeslag|takstol|undertak|membran'
    r'|\bnedl[øo]p\b|rennstein', re.I)
_IS_FASTENER    = re.compile(
    r'skrue|spiker|\bnagel\b|\bstift\b|\bbolt\b|vinkelbeslag|festeplat'
    r'|ankerbeslag|\bklamme\b|nylonplugg|festemidl', re.I)
_IS_BOARD       = re.compile(
    r'\bkledning\b|\bpanel\b|\bspon\b|\bfjel\b|\bgulv(?:bord)?\b|\blekt(?:er)?\b'
    r'|gipsplat|gipsbord|\bosb\b|kryssfinér?|sperreplat', re.I)
_HAS_DIM        = re.compile(r'\d+x\d+')

_CATEGORIES_ORDERED = (
    ("rental",        _IS_RENTAL),
    ("transport",     _IS_TRANSPORT),
    ("tools",         _IS_TOOLS),
    ("electrical",    _IS_ELECTRICAL),
    ("plumbing",      _IS_PLUMBING),
    ("ventilation",   _IS_VENTILATION),
    ("paint",         _IS_PAINT),
    ("doors_windows", _IS_DOOR_WIN),
    ("insulation",    _IS_INSULATION),
    ("terrace",       _IS_TERRACE),
    ("roofing",       _IS_ROOFING),
    ("fasteners",     _IS_FASTENER),
    ("boards",        _IS_BOARD),
)

# Internal key -> Norwegian display name (aligned with v006 DB categories)
_CATEGORY_DISPLAY: dict[str, str] = {
    "timber":        "Trelast",
    "terrace":       "Terrasse",
    "boards":        "Plater",
    "insulation":    "Isolasjon",
    "doors_windows": "Dører og vinduer",
    "fasteners":     "Beslag og festemidler",
    "roofing":       "Tak",
    "plumbing":      "Rør",
    "electrical":    "Elektrisk",
    "ventilation":   "Ventilasjon",
    "paint":         "Maling og overflate",
    "tools":         "Verktøy",
    "transport":     "Transport og tjenester",
    "rental":        "Leieutstyr",
    "miscellaneous": "Diverse",
    "unknown":       "Ukjent",
}


# ── Pure functions ────────────────────────────────────────────────────────────

def normalize_key(description: str) -> str:
    """Return a lowercase grouping key with dimensions and noise words normalised.

    48X198 UH. JUST. C24        ->  48x198 c24
    28X120 MOELVEN ROYAL        ->  28x120 royal
    28X120 ROYAL TERRASSEBORD   ->  28x120 royal   (same key — merged)
    48x198 impregnert           ->  48x198 impregnert  (stays separate)
    """
    s = _DIM_RE.sub(lambda m: f"{m.group(1)}x{m.group(2)}", description)
    s = _NOISE_RE.sub(' ', s)
    s = _TYPE_NOISE_RE.sub(' ', s)
    return ' '.join(s.split()).lower()


def canonical_name(description: str) -> str:
    """Return a clean display name: dimension lowercase, grades uppercase, rest title-cased.

    48X198 UH. JUST. C24  ->  48x198 C24
    28X120 MOELVEN ROYAL TERRASSEBORD  ->  28x120 Royal Terrassebord
    """
    s = _DIM_RE.sub(lambda m: f"{m.group(1)}x{m.group(2)}", description)
    s = _NOISE_RE.sub(' ', s)
    parts = []
    for tok in s.split():
        if re.match(r'^\d+x\d+$', tok):
            parts.append(tok)
        elif _GRADE_RE.match(tok):
            parts.append(tok.upper())
        else:
            parts.append(tok.title())
    return ' '.join(parts)


def normalize_unit(unit: str) -> str:
    """Return the canonical unit string, or the input lowercased when unknown."""
    return _UNIT_CANON.get(unit.strip().lower().rstrip('.'), unit.strip().lower())


def detect_category_key(norm_key: str) -> str:
    """Return internal category key for a normalised product key."""
    if len(norm_key.strip()) < 3:
        return "unknown"
    for cat, pat in _CATEGORIES_ORDERED:
        if pat.search(norm_key):
            return cat
    if _HAS_DIM.search(norm_key):
        return "timber" if _GRADE_RE.search(norm_key) else "boards"
    return "miscellaneous"


def detect_category(norm_key: str) -> str:
    """Return Norwegian category display name for a normalised product key."""
    return _CATEGORY_DISPLAY.get(detect_category_key(norm_key), "Diverse")


def extract_dimension(norm_key: str) -> str:
    """Return dimension string (e.g. '48x198') from a normalised product key, or ''."""
    m = _HAS_DIM.search(norm_key)
    return m.group(0) if m else ""


# ── DB-backed service ─────────────────────────────────────────────────────────

class ProductNormalizerService:
    """Resolves raw product descriptions to canonical Product records.

    On each call to find_or_create():
      1. Check product_aliases for a user-corrected or previously seen mapping.
      2. Check products by normalised key.
      3. Auto-create a new Product and save the raw description as an alias.

    learn_alias() is called when a user manually corrects a product name,
    teaching the system for future invoices.
    """

    def __init__(self, product_repo: "ProductRepository") -> None:
        self._repo = product_repo

    def find_or_create(self, raw_description: str, unit: str = "") -> "Product":
        """Return the Product matching raw_description, creating it if needed."""
        from app.database.models import Product, ProductAlias

        # 1. Alias lookup (learns from previous user corrections)
        product = self._repo.find_by_alias(raw_description)
        if product:
            return product

        # 2. Normalized-key lookup
        norm = normalize_key(raw_description)
        product = self._repo.find_by_normalized_key(norm)
        if product:
            self._repo.add_alias(ProductAlias(
                product_id=product.id,
                alias=raw_description,
                source="detected",
            ))
            return product

        # 3. Create new product
        cat_name = detect_category(norm)
        norm_unit = normalize_unit(unit) if unit else ""
        new_product = Product(
            canonical_name=canonical_name(raw_description),
            normalized_key=norm,
            category=cat_name,
            unit=norm_unit,
        )
        self._repo.save(new_product)
        self._repo.add_alias(ProductAlias(
            product_id=new_product.id,
            alias=raw_description,
            source="detected",
        ))
        return new_product

    def find_or_create_by_canonical(
        self,
        name: str,
        category: str = "",
        unit: str = "",
    ) -> "Product":
        """Find or create a Product with the given canonical name.

        Used when a user enters the correct canonical name during review.
        """
        from app.database.models import Product

        norm = normalize_key(name)
        product = self._repo.find_by_normalized_key(norm)
        if product:
            return product
        new_product = Product(
            canonical_name=canonical_name(name),
            normalized_key=norm,
            category=category or detect_category(norm),
            unit=normalize_unit(unit) if unit else "",
        )
        self._repo.save(new_product)
        return new_product

    def learn_alias(self, raw_alias: str, product: "Product") -> None:
        """Save a user-corrected mapping: raw_alias -> product.

        The next time raw_alias appears in an invoice it will be resolved
        automatically to this product without creating a review item.
        """
        from app.database.models import ProductAlias

        self._repo.add_alias(ProductAlias(
            product_id=product.id,
            alias=raw_alias,
            source="user_correction",
        ))
