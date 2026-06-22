"""Unit type classification for line item quantities."""
from __future__ import annotations

from enum import Enum
from typing import Optional


class UnitType(str, Enum):
    PCS     = "pcs"
    M       = "m"
    M2      = "m²"
    M3      = "m³"
    KG      = "kg"
    TON     = "ton"
    LITRE   = "litre"
    PACK    = "pack"
    PALLET  = "pallet"
    UNKNOWN = "unknown"


_UNIT_MAP: dict[str, UnitType] = {
    "stk":     UnitType.PCS,
    "pcs":     UnitType.PCS,
    "pk":      UnitType.PACK,
    "pk/pall": UnitType.PACK,
    "pall":    UnitType.PALLET,
    "im":      UnitType.M,    # løpemeter — OCR often reads "lm" as "Im"
    "lm":      UnitType.M,
    "m":       UnitType.M,
    "m2":      UnitType.M2,
    "m²":      UnitType.M2,
    "m3":      UnitType.M3,
    "m³":      UnitType.M3,
    "kg":      UnitType.KG,
    "ton":     UnitType.TON,
    "tonn":    UnitType.TON,
    "l":       UnitType.LITRE,
    "liter":   UnitType.LITRE,
    "litre":   UnitType.LITRE,
}


def classify_unit(unit_str: Optional[str]) -> UnitType:
    """Map an OCR unit string to a canonical UnitType."""
    if not unit_str:
        return UnitType.UNKNOWN
    return _UNIT_MAP.get(unit_str.lower().strip(), UnitType.UNKNOWN)


def compute_normalized_quantity(
    quantity: Optional[float],
    unit_type: UnitType,
    total_length: Optional[float],
) -> Optional[float]:
    """Return the quantity expressed in the canonical unit.

    For bundle items ("22 stk a 4,8 m"), unit_type=m and total_length=105.6.
    In that case total_length is the correct normalised value, not the piece count.
    """
    if unit_type == UnitType.M and total_length is not None:
        return total_length
    return quantity
