"""Tests for the configuration system."""
from app.config import Config, config


class TestConfig:
    def test_singleton_is_config_instance(self):
        assert isinstance(config, Config)

    def test_app_name(self):
        assert config.APP_NAME == "Smart Invoice Summarizer"

    def test_app_version_semver(self):
        parts = config.APP_VERSION.split(".")
        assert len(parts) == 3
        assert all(p.isdigit() for p in parts)

    def test_db_path_is_under_data_dir(self):
        assert config.DB_DIR in config.DB_PATH.parents or config.DB_PATH.parent == config.DB_DIR

    def test_copies_dir_under_data_dir(self):
        assert config.COPIES_DIR.parent == config.DATA_DIR

    def test_threshold_ordering(self):
        assert config.SUPPLIER_REVIEW_THRESHOLD < config.SUPPLIER_AUTO_MATCH_THRESHOLD
        assert config.PRODUCT_REVIEW_THRESHOLD < config.PRODUCT_AUTO_MATCH_THRESHOLD

    def test_thresholds_in_valid_range(self):
        for val in (
            config.SUPPLIER_AUTO_MATCH_THRESHOLD,
            config.SUPPLIER_REVIEW_THRESHOLD,
            config.PRODUCT_AUTO_MATCH_THRESHOLD,
            config.PRODUCT_REVIEW_THRESHOLD,
        ):
            assert 0 <= val <= 100

    def test_ensure_dirs_creates_directories(self, tmp_path):
        cfg = Config()
        cfg.DATA_DIR = tmp_path / "data"
        cfg.DB_DIR = cfg.DATA_DIR / "db"
        cfg.COPIES_DIR = cfg.DATA_DIR / "copies"
        cfg.EXPORTS_DIR = cfg.DATA_DIR / "exports"
        cfg.DB_PATH = cfg.DB_DIR / "invoices.db"
        cfg.ensure_dirs()
        assert cfg.DB_DIR.exists()
        assert cfg.COPIES_DIR.exists()
        assert cfg.EXPORTS_DIR.exists()
