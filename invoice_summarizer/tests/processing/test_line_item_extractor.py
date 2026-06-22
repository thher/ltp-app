"""Tests for LineItemExtractor — spatial OCR line item extraction."""
import pytest

from app.processing.line_item_extractor import LineItemExtractor, ExtractedLineItem
from app.processing.ocr_engine import OcrResult, OcrWord


def _word(text: str, left: int, top: int, w: int = 60, h: int = 20) -> OcrWord:
    return OcrWord(text=text, left=left, top=top, width=w, height=h, conf=0.9)


def _page(*rows: list[OcrWord], width: int = 1655, height: int = 2340) -> OcrResult:
    """Build an OcrResult from a list of word rows."""
    all_words = [w for row in rows for w in row]
    text = " ".join(w.text for w in all_words)
    return OcrResult(
        text=text,
        words=all_words,
        page_width=width,
        page_height=height,
    )


@pytest.fixture()
def extractor():
    return LineItemExtractor()


class TestGroupWordsIntoRows:
    def test_single_row(self, extractor):
        words = [_word("A", 10, 100), _word("B", 100, 102)]
        rows = extractor._group_words_into_rows(words)
        assert len(rows) == 1
        assert len(rows[0]) == 2

    def test_two_rows(self, extractor):
        words = [_word("A", 10, 100), _word("B", 10, 130)]
        rows = extractor._group_words_into_rows(words)
        assert len(rows) == 2

    def test_sorted_left_within_row(self, extractor):
        words = [_word("B", 200, 100), _word("A", 10, 100)]
        rows = extractor._group_words_into_rows(words)
        assert rows[0][0].text == "A"
        assert rows[0][1].text == "B"


class TestAssignToColumns:
    def test_description_column(self, extractor):
        bounds = extractor._compute_col_bounds(1655)
        words = [_word("Tape", 50, 100, w=80)]
        cols = extractor._assign_to_columns(words, bounds)
        assert "Tape" in cols["description"]

    def test_amount_column(self, extractor):
        bounds = extractor._compute_col_bounds(1655)
        # Amount column: x=1340–1655, centre at ~1497
        words = [_word("140,00", 1400, 100, w=80)]
        cols = extractor._assign_to_columns(words, bounds)
        assert "140,00" in cols["amount"]

    def test_quantity_column(self, extractor):
        bounds = extractor._compute_col_bounds(1655)
        # Quantity column: x=615–785, centre at ~700
        words = [_word("5", 660, 100, w=20)]
        cols = extractor._assign_to_columns(words, bounds)
        assert "5" in cols["quantity"]


class TestParseNumber:
    @pytest.mark.parametrize("raw,expected", [
        ("140,00", 140.0),
        ("1 113,80", 1113.8),
        ("45 000,00", 45000.0),
        ("88 729,40", 88729.4),
        ("12000.00", 12000.0),
        ("", None),
        ("abc", None),
    ])
    def test_parse_number(self, extractor, raw, expected):
        result = extractor._parse_number(raw)
        if expected is None:
            assert result is None
        else:
            assert result == pytest.approx(expected, rel=1e-4)


class TestExtractFromOcr:
    def _make_table_page(self) -> OcrResult:
        """Build a minimal invoice page with a table header and two line items."""
        # Table header row at y=200
        header_row = [
            _word("Tekst", 50, 200),
            _word("Antall", 650, 200),
            _word("Pris", 820, 200),
            _word("Enh", 1010, 200),
            _word("Rabatt", 1100, 200),
            _word("MVA", 1250, 200),
            _word("Beløp", 1400, 200),
        ]
        # Line item 1 at y=240: "Folie tape" | 1 | 140,00 | STK | | 25 | 140,00
        item1_row = [
            _word("Folie", 50, 240, w=70),
            _word("tape", 125, 240, w=60),
            _word("1", 660, 240, w=20),
            _word("140,00", 820, 240, w=80),
            _word("STK", 1010, 240, w=50),
            _word("25", 1250, 240, w=30),
            _word("140,00", 1400, 240, w=80),
        ]
        # Line item 2 at y=270: "Transport" | 1 | 300,00 | | | 25 | 300,00
        item2_row = [
            _word("Transport", 50, 270, w=110),
            _word("1", 660, 270, w=20),
            _word("300,00", 820, 270, w=80),
            _word("25", 1250, 270, w=30),
            _word("300,00", 1400, 270, w=80),
        ]
        return _page(header_row, item1_row, item2_row)

    def test_extracts_two_items(self, extractor):
        page = self._make_table_page()
        items = extractor.extract_from_ocr([page])
        assert len(items) == 2

    def test_first_item_description(self, extractor):
        page = self._make_table_page()
        items = extractor.extract_from_ocr([page])
        assert "Folie" in items[0].description or "tape" in items[0].description

    def test_first_item_amount(self, extractor):
        page = self._make_table_page()
        items = extractor.extract_from_ocr([page])
        assert items[0].line_total == pytest.approx(140.0)

    def test_second_item_description(self, extractor):
        page = self._make_table_page()
        items = extractor.extract_from_ocr([page])
        assert "Transport" in items[1].description

    def test_stop_at_mva_section(self, extractor):
        """Rows after 'MVA (' should not be extracted as line items."""
        header_row = [
            _word("Tekst", 50, 200), _word("Antall", 650, 200),
            _word("Pris", 820, 200), _word("Enh", 1010, 200),
            _word("Beløp", 1400, 200),
        ]
        item_row = [
            _word("Tape", 50, 240), _word("1", 660, 240),
            _word("100,00", 1400, 240),
        ]
        stop_row = [
            _word("MVA", 50, 300), _word("(25", 100, 300),
            _word("%", 140, 300), _word("av", 180, 300),
        ]
        after_stop = [
            _word("Noise", 50, 340), _word("9", 660, 340),
            _word("999,00", 1400, 340),
        ]
        page = _page(header_row, item_row, stop_row, after_stop)
        items = extractor.extract_from_ocr([page])
        # Only the item before the stop line should be extracted
        assert len(items) == 1

    def test_empty_page_returns_empty(self, extractor):
        page = OcrResult(text="", words=[], page_width=1655, page_height=2340)
        items = extractor.extract_from_ocr([page])
        assert items == []

    def test_no_table_header_returns_empty(self, extractor):
        """Without a table header row, nothing should be extracted."""
        item_row = [
            _word("Tape", 50, 240), _word("1", 660, 240),
            _word("100,00", 1400, 240),
        ]
        page = _page(item_row)
        items = extractor.extract_from_ocr([page])
        assert items == []


class TestExtractedLineItemConfidence:
    def test_full_row_high_confidence(self, extractor):
        cols = {
            "description": "Tape",
            "quantity": "2",
            "unit_price": "50,00",
            "unit": "STK",
            "discount": "",
            "vat": "25",
            "amount": "100,00",
        }
        item = extractor._build_item(cols, "Tape", "")
        assert item is not None
        assert item.confidence >= 0.75
        assert not item.needs_review

    def test_missing_qty_lowers_confidence(self, extractor):
        cols = {
            "description": "Tape",
            "quantity": "",
            "unit_price": "",
            "unit": "",
            "discount": "",
            "vat": "",
            "amount": "100,00",
        }
        item = extractor._build_item(cols, "Tape", "")
        assert item is not None
        assert item.confidence < 1.0

    def test_no_amount_no_price_returns_none(self, extractor):
        cols = {k: "" for k in ("description", "quantity", "unit_price",
                                "unit", "discount", "vat", "amount")}
        cols["description"] = "Section Header"
        item = extractor._build_item(cols, "Section Header", "")
        assert item is None
