import sqlite3
from collections.abc import Sequence
from typing import Any


class BaseRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    def fetch_one(self, query: str, params: Sequence[Any] = ()) -> sqlite3.Row | None:
        return self.conn.execute(query, params).fetchone()

    def fetch_all(self, query: str, params: Sequence[Any] = ()) -> list[sqlite3.Row]:
        return list(self.conn.execute(query, params).fetchall())

    def execute(self, query: str, params: Sequence[Any] = ()) -> sqlite3.Cursor:
        return self.conn.execute(query, params)
