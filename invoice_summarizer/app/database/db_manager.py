import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Generator, Optional

from app.config import config


class DatabaseManager:
    """
    Thread-safe SQLite manager using thread-local connections.
    Each thread gets its own connection; each instance gets its own
    thread-local slot so multiple managers can coexist (e.g. in tests).
    """

    def __init__(self, db_path: Optional[Path] = None) -> None:
        self._local = threading.local()   # per-instance, not per-class
        self.db_path = db_path or config.DB_PATH
        if str(self.db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

    # ── Connection ────────────────────────────────────────────────────

    @property
    def connection(self) -> sqlite3.Connection:
        conn = getattr(self._local, "connection", None)
        if conn is None:
            conn = sqlite3.connect(
                str(self.db_path),
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA synchronous=NORMAL")
            self._local.connection = conn
        return conn

    def close(self) -> None:
        conn = getattr(self._local, "connection", None)
        if conn is not None:
            conn.close()
            self._local.connection = None

    # ── Transaction helpers ───────────────────────────────────────────

    @contextmanager
    def transaction(self) -> Generator[sqlite3.Connection, None, None]:
        conn = self.connection
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    # ── Query helpers ─────────────────────────────────────────────────

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        return self.connection.execute(sql, params)

    def executemany(self, sql: str, params_seq: list[tuple]) -> sqlite3.Cursor:
        return self.connection.executemany(sql, params_seq)

    def fetchone(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        return self.connection.execute(sql, params).fetchone()

    def fetchall(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        return self.connection.execute(sql, params).fetchall()

    def fetchscalar(self, sql: str, params: tuple = ()) -> Any:
        row = self.fetchone(sql, params)
        return row[0] if row else None

    def commit(self) -> None:
        self.connection.commit()
