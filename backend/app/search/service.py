import html
import re
import time
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from app.db.database import connect

CATEGORY_ALIASES = {
    "project": "project",
    "projects": "project",
    "file": "file",
    "files": "file",
    "cad": "cad",
    "drawing": "cad",
    "drawings": "cad",
    "material": "material",
    "materials": "material",
    "knowledge": "knowledge",
    "knowledges": "knowledge",
}
TYPE_TO_CATEGORY = {
    "all": None,
    "project": "project",
    "file": "file",
    "drawing": "cad",
    "material": "material",
    "knowledge": "knowledge",
}
SQLITE_BIND_BATCH_SIZE = 500
SEARCH_ALIASES = {
    "cad": (".dwg", ".dxf", "图纸"),
    "pdf": (".pdf",),
}


@dataclass(frozen=True)
class SearchResult:
    entity_id: str
    entity_type: str
    title: str
    project_id: str
    highlighted_content: str
    score: float

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class UnifiedSearchResult:
    result_id: str
    entity_type: str
    entity_id: str
    project_id: str | None
    project_name: str | None
    title: str
    relative_path: str | None
    parent_path: str | None
    extension: str | None
    category: str | None
    file_id: str | None
    available: bool
    labels: tuple[str, ...]
    match_source: str | None
    highlighted_content: str
    score: float

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["labels"] = list(self.labels)
        return data


@dataclass(frozen=True)
class SearchPage:
    query: str
    items: tuple[UnifiedSearchResult, ...]
    total: int
    limit: int
    offset: int
    has_more: bool
    elapsed_ms: float

    def to_dict(self) -> dict[str, object]:
        return {
            "query": self.query,
            "items": [item.to_dict() for item in self.items],
            "total": self.total,
            "limit": self.limit,
            "offset": self.offset,
            "has_more": self.has_more,
            "elapsed_ms": self.elapsed_ms,
        }


def normalize_query(query: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", query).split())


def build_fts_query(query: str) -> str:
    terms = [term.replace('"', '""') for term in query.split() if term.strip()]
    return " ".join(f'"{term}"' for term in terms)


def _like_pattern(value: str) -> str:
    return "%" + value.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"


def _search_alternatives(term: str) -> tuple[str, ...]:
    return (term, *SEARCH_ALIASES.get(term.casefold(), ()))


def normalize_category(category: str | None) -> str | None:
    if category is None:
        return None
    normalized = category.strip().lower()
    if not normalized:
        return None
    if normalized not in CATEGORY_ALIASES:
        raise ValueError("category_invalid")
    return CATEGORY_ALIASES[normalized]


def normalize_type(entity_type: str | None) -> str | None:
    if entity_type is None:
        return None
    normalized = entity_type.strip().lower()
    if not normalized:
        return None
    if normalized not in TYPE_TO_CATEGORY:
        raise ValueError("type_invalid")
    return TYPE_TO_CATEGORY[normalized]


def _raw_rows(
    conn: Any,
    *,
    normalized_query: str,
    category: str | None,
    project_id: str | None,
    limit: int | None,
) -> list[Any]:
    fts_query = build_fts_query(normalized_query)
    clauses = ["fts_global MATCH ?"]
    params: list[object] = [fts_query]
    if category:
        clauses.append("entity_type = ?")
        params.append(category)
    if project_id:
        clauses.append("project_id = ?")
        params.append(project_id)
    suffix = ""
    if limit is not None:
        suffix = " LIMIT ?"
        params.append(limit)
    rows = conn.execute(
        f"""
        SELECT entity_id, entity_type, title, project_id,
               snippet(fts_global, 3, '<mark>', '</mark>', '...', 12) AS highlighted_content,
               bm25(fts_global, 5.0, 3.0, 10.0, 4.0, 1.0) AS score
        FROM fts_global
        WHERE {' AND '.join(clauses)}
        ORDER BY score ASC, entity_type ASC, title COLLATE NOCASE ASC, entity_id ASC
        {suffix}
        """,
        params,
    ).fetchall()
    terms = normalized_query.split()
    needs_fallback = not rows or any(term.casefold() in SEARCH_ALIASES for term in terms) or any(ord(char) > 127 for char in normalized_query)
    if not needs_fallback:
        return rows

    conditions: list[str] = []
    fallback_params: list[object] = []
    for term in terms:
        alternatives = _search_alternatives(term)
        conditions.append("(" + " OR ".join("(title LIKE ? ESCAPE '!' OR content LIKE ? ESCAPE '!')" for _ in alternatives) + ")")
        for alternative in alternatives:
            pattern = _like_pattern(alternative)
            fallback_params.extend((pattern, pattern))
    if category:
        conditions.append("entity_type = ?")
        fallback_params.append(category)
    if project_id:
        conditions.append("project_id = ?")
        fallback_params.append(project_id)
    fallback_suffix = ""
    if limit is not None:
        fallback_suffix = " LIMIT ?"
        fallback_params.append(limit)
    fallback_rows = conn.execute(
        f"""
        SELECT entity_id, entity_type, title, project_id,
               substr(content, 1, 240) AS highlighted_content,
               1000.0 AS score
        FROM fts_global
        WHERE {' AND '.join(conditions)}
        ORDER BY entity_type ASC, title COLLATE NOCASE ASC, entity_id ASC
        {fallback_suffix}
        """,
        fallback_params,
    ).fetchall()
    seen = {(row["entity_type"], row["entity_id"]) for row in rows}
    return [*rows, *(row for row in fallback_rows if (row["entity_type"], row["entity_id"]) not in seen)]


def search(
    query: str,
    *,
    category: str | None = None,
    limit: int = 20,
    db_path: Path | None = None,
) -> list[SearchResult]:
    normalized_query = normalize_query(query)
    if not normalized_query:
        raise ValueError("query_required")
    resolved_category = normalize_category(category)
    resolved_limit = max(1, min(int(limit), 100))
    with connect(db_path) as conn:
        rows = _raw_rows(
            conn,
            normalized_query=normalized_query,
            category=resolved_category,
            project_id=None,
            limit=resolved_limit,
        )
    return [
        SearchResult(
            entity_id=row["entity_id"],
            entity_type=row["entity_type"],
            title=row["title"],
            project_id=row["project_id"],
            highlighted_content=row["highlighted_content"] or "",
            score=float(row["score"]),
        )
        for row in rows[:resolved_limit]
    ]


def _fetch_metadata(conn: Any, rows: list[Any]) -> dict[tuple[str, str], dict[str, Any]]:
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(row["entity_type"], []).append(row["entity_id"])
    metadata: dict[tuple[str, str], dict[str, Any]] = {}

    def select_many(entity_type: str, query: str) -> None:
        identifiers = grouped.get(entity_type, [])
        if not identifiers:
            return
        for start in range(0, len(identifiers), SQLITE_BIND_BATCH_SIZE):
            batch = identifiers[start:start + SQLITE_BIND_BATCH_SIZE]
            placeholders = ",".join("?" for _ in batch)
            for item in conn.execute(query.format(placeholders=placeholders), batch).fetchall():
                metadata[(entity_type, item["entity_id"])] = dict(item)

    select_many(
        "project",
        """
        SELECT p.id AS entity_id, p.id AS project_id, p.name AS project_name, p.name AS title,
               NULL AS relative_path, NULL AS parent_path, NULL AS extension, NULL AS category,
               NULL AS file_id, p.project_path
        FROM projects p WHERE p.id IN ({placeholders})
        """,
    )
    select_many(
        "file",
        """
        SELECT f.id AS entity_id, f.project_id, p.name AS project_name, f.file_name AS title,
               f.relative_path, f.relative_dir AS parent_path, f.extension, NULL AS category,
               f.id AS file_id, p.project_path
        FROM files f JOIN projects p ON p.id = f.project_id WHERE f.id IN ({placeholders})
        """,
    )
    select_many(
        "cad",
        """
        SELECT d.id AS entity_id, d.project_id, p.name AS project_name, f.file_name AS title,
               f.relative_path, f.relative_dir AS parent_path, f.extension, d.dwg_category AS category,
               f.id AS file_id, p.project_path
        FROM drawings d JOIN files f ON f.id = d.file_id JOIN projects p ON p.id = d.project_id
        WHERE d.id IN ({placeholders})
        """,
    )
    select_many(
        "material",
        """
        SELECT m.id AS entity_id, m.project_id, p.name AS project_name, f.file_name AS title,
               f.relative_path, f.relative_dir AS parent_path, f.extension, m.material_type AS category,
               f.id AS file_id, p.project_path
        FROM materials m LEFT JOIN files f ON f.id = m.file_id JOIN projects p ON p.id = m.project_id
        WHERE m.id IN ({placeholders})
        """,
    )
    select_many(
        "knowledge",
        """
        SELECT 'knowledge:' || p.id AS entity_id, p.id AS project_id,
               p.name AS project_name, p.name || ' Knowledge' AS title,
               NULL AS relative_path, NULL AS parent_path, NULL AS extension,
               NULL AS category, NULL AS file_id, p.project_path
        FROM projects p WHERE ('knowledge:' || p.id) IN ({placeholders})
        """,
    )
    return metadata


def _available(item: dict[str, Any]) -> bool:
    project_path = item.get("project_path")
    relative_path = item.get("relative_path")
    if not project_path:
        return False
    root = Path(project_path)
    target = root if not relative_path else root / relative_path
    try:
        resolved_root = root.resolve(strict=True)
        resolved_target = target.resolve(strict=True)
        return resolved_target.is_relative_to(resolved_root)
    except (OSError, RuntimeError):
        return False


def _safe_highlight(value: str | None) -> str:
    text = (value or "").replace("<mark>", "").replace("</mark>", "")
    return html.escape(text, quote=False)


def _public_type(entity_type: str) -> str | None:
    return {
        "project": "project",
        "file": "file",
        "cad": "drawing",
        "material": "material",
        "knowledge": "knowledge",
    }.get(entity_type)


def _labels(entity_type: str) -> tuple[str, ...]:
    return {
        "project": ("project",),
        "file": ("file",),
        "cad": ("file", "drawing"),
        "material": ("file", "material"),
        "knowledge": ("knowledge",),
    }.get(entity_type, ())


def _match_source(item: dict[str, Any], query: str) -> str | None:
    needle = query.casefold()
    title = (item.get("title") or "").casefold()
    project_name = (item.get("project_name") or "").casefold()
    path = (item.get("relative_path") or "").casefold()
    category = (item.get("category") or "").casefold()
    extension = (item.get("extension") or "").casefold()
    if needle in title:
        return "title"
    if needle in project_name:
        return "project_name"
    if needle in path:
        return "path"
    if needle in category:
        return "category"
    if needle in extension:
        return "extension"
    if needle in SEARCH_ALIASES:
        return "alias"
    return "content"


def _natural_key(value: str) -> str:
    return re.sub(r"\d+", lambda match: f"{int(match.group()):012d}", value.casefold())


def _sort_key(item: UnifiedSearchResult, query: str) -> tuple[Any, ...]:
    needle = query.casefold()
    title = item.title.casefold()
    path = (item.relative_path or "").casefold()
    category = (item.category or "").casefold()
    exact_project = item.entity_type == "project" and title == needle
    if exact_project:
        match_rank = 0
    elif title == needle:
        match_rank = 1
    elif title.startswith(needle):
        match_rank = 2
    elif needle in title:
        match_rank = 3
    elif needle in path:
        match_rank = 4
    elif needle in category or needle in (item.extension or "").casefold() or needle in SEARCH_ALIASES:
        match_rank = 5
    else:
        match_rank = 6
    type_rank = {"project": 0, "knowledge": 1, "drawing": 2, "material": 3, "file": 4}.get(item.entity_type, 5)
    return (match_rank, item.score, type_rank, _natural_key(item.title), item.result_id)


def search_page(
    query: str,
    *,
    entity_type: str | None = None,
    category: str | None = None,
    project_id: str | None = None,
    limit: int = 20,
    offset: int = 0,
    db_path: Path | None = None,
) -> SearchPage:
    started = time.perf_counter()
    normalized_query = normalize_query(query)
    if not normalized_query:
        raise ValueError("query_required")
    resolved_type = normalize_type(entity_type)
    resolved_category = normalize_category(category)
    if resolved_type and resolved_category and resolved_type != resolved_category:
        raise ValueError("type_category_conflict")
    resolved_category = resolved_type or resolved_category
    resolved_limit = max(1, min(int(limit), 100))
    if int(offset) < 0:
        raise ValueError("offset_invalid")

    with connect(db_path) as conn:
        rows = _raw_rows(
            conn,
            normalized_query=normalized_query,
            category=resolved_category,
            project_id=project_id,
            limit=None,
        )
        metadata = _fetch_metadata(conn, rows)

    merged: dict[str, UnifiedSearchResult] = {}
    for row in rows:
        raw_type = row["entity_type"]
        public_type = _public_type(raw_type)
        item = metadata.get((raw_type, row["entity_id"]))
        if public_type is None or item is None:
            continue
        file_id = item["file_id"]
        key = f"file:{file_id}" if file_id else f"{public_type}:{row['entity_id']}"
        candidate = UnifiedSearchResult(
            result_id=key,
            entity_type=public_type,
            entity_id=row["entity_id"],
            project_id=item["project_id"],
            project_name=item["project_name"],
            title=item["title"] or row["title"],
            relative_path=item["relative_path"],
            parent_path=item["parent_path"],
            extension=item["extension"],
            category=item["category"],
            file_id=file_id,
            available=False,
            labels=_labels(raw_type),
            match_source=_match_source(item, normalized_query),
            highlighted_content=_safe_highlight(row["highlighted_content"]),
            score=float(row["score"]),
        )
        existing = merged.get(key)
        if existing is None:
            merged[key] = candidate
            continue
        labels = tuple(label for label in ("project", "file", "drawing", "material") if label in {*existing.labels, *candidate.labels})
        priority = {"drawing": 0, "material": 1, "file": 2, "knowledge": 3, "project": 4}
        primary = candidate if priority[candidate.entity_type] < priority[existing.entity_type] else existing
        merged[key] = UnifiedSearchResult(
            **{**asdict(primary), "labels": labels, "score": min(existing.score, candidate.score)}
        )

    ordered = sorted(merged.values(), key=lambda item: _sort_key(item, normalized_query))
    page_items = ordered[int(offset):int(offset) + resolved_limit]
    page_items = tuple(
        UnifiedSearchResult(**{**asdict(item), "available": item.entity_type == "knowledge" or _available({
            "project_path": next((value.get("project_path") for value in metadata.values() if value.get("project_id") == item.project_id), None),
            "relative_path": item.relative_path,
        })})
        for item in page_items
    )
    elapsed_ms = round((time.perf_counter() - started) * 1000, 3)
    return SearchPage(
        query=normalized_query,
        items=page_items,
        total=len(ordered),
        limit=resolved_limit,
        offset=int(offset),
        has_more=int(offset) + resolved_limit < len(ordered),
        elapsed_ms=elapsed_ms,
    )
