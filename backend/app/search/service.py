from dataclasses import asdict, dataclass
from pathlib import Path

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


def normalize_query(query: str) -> str:
    return query.strip()


def build_fts_query(query: str) -> str:
    terms = [term.replace('"', '""') for term in query.split() if term.strip()]
    return " ".join(f'"{term}"' for term in terms)


def normalize_category(category: str | None) -> str | None:
    if category is None:
        return None
    normalized = category.strip().lower()
    if not normalized:
        return None
    if normalized not in CATEGORY_ALIASES:
        raise ValueError("category_invalid")
    return CATEGORY_ALIASES[normalized]


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
    fts_query = build_fts_query(normalized_query)

    resolved_category = normalize_category(category)
    resolved_limit = max(1, min(int(limit), 100))
    bm25_weights = (5.0, 3.0, 10.0, 4.0, 1.0)

    with connect(db_path) as conn:
        params: list[object] = [normalized_query, *bm25_weights]
        category_clause = ""
        if resolved_category:
            category_clause = "AND entity_type = ?"
            params.append(resolved_category)
        params.append(resolved_limit)

        rows = conn.execute(
            f"""
            SELECT entity_id,
                   entity_type,
                   title,
                   project_id,
                   snippet(fts_global, 3, '<mark>', '</mark>', '...', 12)
                       AS highlighted_content,
                   bm25(fts_global, ?, ?, ?, ?, ?) AS score
            FROM fts_global
            WHERE fts_global MATCH ?
            {category_clause}
            ORDER BY score ASC
            LIMIT ?
            """,
            [*bm25_weights, fts_query]
            + ([resolved_category] if resolved_category else [])
            + [resolved_limit],
        ).fetchall()

    return [
        SearchResult(
            entity_id=row["entity_id"],
            entity_type=row["entity_type"],
            title=row["title"],
            project_id=row["project_id"],
            highlighted_content=row["highlighted_content"] or "",
            score=float(row["score"]),
        )
        for row in rows
    ]
