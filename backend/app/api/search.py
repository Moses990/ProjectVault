from fastapi import APIRouter, HTTPException, Query

from app.search.service import SearchResult, search

router = APIRouter(prefix="/search", tags=["search"])


def success_response(
    data: object,
    message: str = "ok",
    meta: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "status": "success",
        "data": data,
        "message": message,
        "meta": meta or {},
    }


def _serialize_results(results: list[SearchResult]) -> list[dict[str, object]]:
    return [item.to_dict() for item in results]


@router.get("")
def get_search(
    q: str = Query(...),
    category: str | None = None,
    limit: int = 20,
) -> dict[str, object]:
    try:
        results = search(q, category=category, limit=limit)
    except ValueError as exc:
        detail = str(exc)
        if detail == "category_invalid":
            raise HTTPException(status_code=400, detail=detail) from exc
        raise HTTPException(status_code=400, detail="query_required") from exc

    return success_response(
        _serialize_results(results),
        "search_completed",
        {"total": len(results), "category": category, "limit": limit},
    )
