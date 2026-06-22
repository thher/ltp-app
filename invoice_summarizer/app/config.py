from pathlib import Path

BASE_DIR = Path(__file__).parent.parent


class Config:
    APP_NAME = "Smart Invoice Summarizer"
    APP_VERSION = "0.4.0"

    # ── Paths ──────────────────────────────────────────────────────────
    DATA_DIR = BASE_DIR / "data"
    DB_DIR = DATA_DIR / "db"
    COPIES_DIR = DATA_DIR / "copies"
    DB_PATH = DB_DIR / "invoices.db"
    EXPORTS_DIR = BASE_DIR / "exports"

    # ── Processing thresholds ──────────────────────────────────────────
    # rapidfuzz score 0–100: above AUTO = accept silently,
    # between REVIEW and AUTO = accept + flag, below REVIEW = new record
    SUPPLIER_AUTO_MATCH_THRESHOLD: int = 90
    SUPPLIER_REVIEW_THRESHOLD: int = 70
    PRODUCT_AUTO_MATCH_THRESHOLD: int = 85
    PRODUCT_REVIEW_THRESHOLD: int = 65

    # ── Currency ───────────────────────────────────────────────────────
    DEFAULT_CURRENCY: str = "SEK"

    # ── UI ─────────────────────────────────────────────────────────────
    WINDOW_TITLE: str = "Smart Invoice Summarizer"
    WINDOW_MIN_WIDTH: int = 1280
    WINDOW_MIN_HEIGHT: int = 800

    # ── AI hooks (future) ──────────────────────────────────────────────
    AI_CLASSIFICATION_ENABLED: bool = False
    AI_MODEL_ENDPOINT: str = ""

    def ensure_dirs(self) -> None:
        for d in (self.DB_DIR, self.COPIES_DIR, self.EXPORTS_DIR):
            d.mkdir(parents=True, exist_ok=True)


config = Config()
