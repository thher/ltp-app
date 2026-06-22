"""Tests for unit_classifier and material_classifier."""
from __future__ import annotations

import pytest

from app.processing.unit_classifier import UnitType, classify_unit, compute_normalized_quantity
from app.processing.material_classifier import MaterialCategory, classify_material


# ── Unit classifier ────────────────────────────────────────────────────────────

class TestClassifyUnit:
    @pytest.mark.parametrize("raw,expected", [
        ("stk",     UnitType.PCS),
        ("STK",     UnitType.PCS),
        ("Im",      UnitType.M),    # OCR artefact for "lm"
        ("lm",      UnitType.M),
        ("m",       UnitType.M),
        ("m2",      UnitType.M2),
        ("m²",      UnitType.M2),
        ("m3",      UnitType.M3),
        ("m³",      UnitType.M3),
        ("kg",      UnitType.KG),
        ("ton",     UnitType.TON),
        ("tonn",    UnitType.TON),
        ("pk",      UnitType.PACK),
        ("pk/pall", UnitType.PACK),
        ("pall",    UnitType.PALLET),
        ("l",       UnitType.LITRE),
        ("liter",   UnitType.LITRE),
        ("XYZ",     UnitType.UNKNOWN),
        (None,      UnitType.UNKNOWN),
        ("",        UnitType.UNKNOWN),
    ])
    def test_classify(self, raw, expected):
        assert classify_unit(raw) == expected


class TestNormalizedQuantity:
    def test_pcs_uses_quantity(self):
        assert compute_normalized_quantity(22.0, UnitType.PCS, None) == 22.0

    def test_linear_bundle_uses_total_length(self):
        # "22 stk a 4,8 m" → total_length=105.6, normalized should be 105.6
        assert compute_normalized_quantity(22.0, UnitType.M, 105.6) == pytest.approx(105.6)

    def test_linear_no_bundle_uses_quantity(self):
        # Im unit, no bundle prefix → use the qty column value
        assert compute_normalized_quantity(6200.0, UnitType.M, None) == 6200.0

    def test_none_quantity_passes_through(self):
        assert compute_normalized_quantity(None, UnitType.PCS, None) is None


# ── Material classifier ────────────────────────────────────────────────────────

class TestClassifyMaterial:
    @pytest.mark.parametrize("desc,expected", [
        # Transport
        ("TRANSPORT KRANBIL",                          MaterialCategory.TRANSPORT),
        ("0500N TRANSPORT KRANBIL",                    MaterialCategory.TRANSPORT),
        ("PALL OG EMBALLASJE",                         MaterialCategory.TRANSPORT),
        ("inng frakt og embalasje",                    MaterialCategory.TRANSPORT),
        # Decking
        ("28X120 ROYAL TERRASSEBORD",                  MaterialCategory.DECKING),
        ("TERRASSESKRUER A4 4,8X60/75",                MaterialCategory.DECKING),
        ("FAST DEKK KAPPE HVIT",                       MaterialCategory.DECKING),
        ("DEKKLIST SORT",                              MaterialCategory.DECKING),
        # Insulation
        ("GLAVA (OBS A-PLATE) 5 CM",                   MaterialCategory.INSULATION),
        ("13,44M2 RW A-PL 10 CM/4.14 M2 PK 24",       MaterialCategory.INSULATION),
        ("HALOTEX MASTER TAPE (MULTI)",                MaterialCategory.INSULATION),
        ("JACKON FESTESKIVE MED",                      MaterialCategory.INSULATION),
        # Drywall
        ("13 mm GIPSPL. 120x240 50 PL/PK",            MaterialCategory.DRYWALL),
        ("SKJØTEBÅND GIPS 50 LM",                     MaterialCategory.DRYWALL),
        # Doors
        ("BASE 1 DØR DIV STR BYGG1",                  MaterialCategory.DOORS),
        ("BASE 1 90X210",                              MaterialCategory.DOORS),
        ("BASE 1 SD 90X210",                           MaterialCategory.DOORS),
        ("SKYVEDØR TILSETTNING DØRSETT 70MM",          MaterialCategory.DOORS),
        ("YD FJELL 9X21 H SORT EI30/40DB",             MaterialCategory.DOORS),
        ("DRSETT 12058",                               MaterialCategory.DOORS),
        # Windows
        ("YD SOLA 11X120 V SORT",                      MaterialCategory.WINDOWS),
        ("YD 11x21 H svart",                           MaterialCategory.WINDOWS),
        # Trim/Mouldings
        ("9X30MM EIK FEIELIST",                        MaterialCategory.TRIM),
        ("12X58 GULV/DØRLIST MALT",                    MaterialCategory.TRIM),
        ("12X058 GLATTKANT NCS S0500-N",               MaterialCategory.TRIM),
        ("HVITMALT KARM MED",                          MaterialCategory.TRIM),
        ("18MM LIMTREFOR. HVITMALT",                   MaterialCategory.TRIM),
        ("18X45 TILSETNING MALT",                      MaterialCategory.TRIM),
        # Fasteners
        ("MASKERINGSTAPE BLÅ 19MM",                    MaterialCategory.FASTENERS),
        ("SEAL N BOND H750",                           MaterialCategory.FASTENERS),
        ("FUGESKUM FLEX/ALL SEASON",                   MaterialCategory.FASTENERS),
        ("GRÅ/BRUN FAST UTV SKRUER 6,0X120",           MaterialCategory.FASTENERS),
        # Paint
        ("LYSSAND FLIKK MALING",                       MaterialCategory.PAINT),
        ("GLATTEMIDDEL",                               MaterialCategory.PAINT),
        # Hardware
        ("MIAMI DØRVRIDER",                            MaterialCategory.HARDWARE),
        ("SYLINDERSETT 42 SVART",                      MaterialCategory.HARDWARE),
        ("FLEXIT FRISKLUFTSVENTIL",                    MaterialCategory.HARDWARE),
        # Timber
        ("48x48 LEKTER IMPREGNERT",                    MaterialCategory.TIMBER),
        ("48x148 JUST. IMPREGNERT",                    MaterialCategory.TIMBER),
        ("19x148 DF tett tryr",                        MaterialCategory.TIMBER),
        # Concrete
        ("GRUS (STRØ SINGEL) 2-4 MM 20",              MaterialCategory.CONCRETE),
        ("SALT",                                       MaterialCategory.CONCRETE),
        # Other
        ("IBG",                                        MaterialCategory.OTHER),
        ("43",                                         MaterialCategory.OTHER),
        ("skygrå røykbrun, stormsort plukktilleg",     MaterialCategory.OTHER),
    ])
    def test_classify(self, desc, expected):
        result = classify_material(desc)
        assert result == expected, (
            f"classify_material({desc!r}) = {result!r}, expected {expected!r}"
        )

    def test_case_insensitive(self):
        assert classify_material("transport kranbil") == MaterialCategory.TRANSPORT
        assert classify_material("TERRASSEBORD") == MaterialCategory.DECKING

    def test_empty_string_is_other(self):
        assert classify_material("") == MaterialCategory.OTHER
