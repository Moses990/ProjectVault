import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.core.config import get_settings
from app.db.schema import CURRENT_SCHEMA_VERSION, SCHEMA_V1_STATEMENTS


def get_database_path() -> Path:
    path = get_settings().database_path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connect(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    database_path = (path or get_database_path()).resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(database_path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def apply_runtime_pragmas(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.execute("PRAGMA cache_size = -64000;")


def apply_file_pragmas(conn: sqlite3.Connection) -> None:
    auto_vacuum = int(conn.execute("PRAGMA auto_vacuum").fetchone()[0])
    conn.execute("PRAGMA auto_vacuum = INCREMENTAL;")
    if auto_vacuum == 0:
        conn.commit()
        conn.execute("VACUUM;")
    conn.execute("PRAGMA journal_mode = WAL;")


def get_user_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def set_user_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute(f"PRAGMA user_version = {version};")


def apply_v1_schema(conn: sqlite3.Connection) -> None:
    for statement in SCHEMA_V1_STATEMENTS:
        conn.execute(statement)
    conn.execute(
        """
        INSERT OR IGNORE INTO schema_migrations (version)
        VALUES ('1')
        """
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO app_metadata (key, value)
        VALUES ('schema_version', ?)
        """,
        (str(CURRENT_SCHEMA_VERSION),),
    )
    set_user_version(conn, CURRENT_SCHEMA_VERSION)


def migrate(conn: sqlite3.Connection) -> None:
    version = get_user_version(conn)
    if version == 0:
        apply_v1_schema(conn)
        return
    if version == CURRENT_SCHEMA_VERSION:
        apply_v1_schema(conn)
        return
    if version > CURRENT_SCHEMA_VERSION:
        raise RuntimeError(
            f"Database schema version {version} is newer than supported "
            f"version {CURRENT_SCHEMA_VERSION}."
        )


def initialize_database(path: Path | None = None) -> Path:
    database_path = (path or get_database_path()).resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with connect(database_path) as conn:
        apply_runtime_pragmas(conn)
        apply_file_pragmas(conn)
        migrate(conn)
    return database_path
