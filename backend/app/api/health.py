import sqlite3
from urllib.parse import quote

from fastapi import APIRouter

from app.core.config import resolve_runtime_database
from app.db.database import get_database_path

router = APIRouter(tags=["health"])


def database_user_version(path: str) -> int | None:
    try:
        with sqlite3.connect(f"file:{quote(path)}?mode=ro", uri=True) as conn:
            return int(conn.execute("PRAGMA user_version").fetchone()[0])
    except sqlite3.Error:
        return None


@router.get("/health")
def health_check() -> dict[str, object]:
    runtime = resolve_runtime_database()
    database_path = get_database_path()
    return {
        "status": "ok",
        "service": "project-vault-backend",
        "database": {
            "exists": database_path.exists(),
        },
        "runtime_mode": runtime.mode,
        "database_source": runtime.source,
        "database_user_version": database_user_version(str(database_path)),
    }
