from fastapi import APIRouter, HTTPException, Query

from app.search.service import search_page

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


@router.get("")
def get_search(
    q: str = Query(...),
    type: str | None = None,
    category: str | None = None,
    project_id: str | None = None,
    limit: int = 20,
    offset: int = Query(0, ge=0),
) -> dict[str, object]:
    if len(q) > 200:
        raise HTTPException(status_code=400, detail="query_too_long")
    try:
        result = search_page(
            q,
            entity_type=type,
            category=category,
            project_id=project_id,
            limit=limit,
            offset=offset,
        )
    except ValueError as exc:
        detail = str(exc)
        if detail in {"category_invalid", "type_invalid", "type_category_conflict", "offset_invalid"}:
            raise HTTPException(status_code=400, detail=detail) from exc
        raise HTTPException(status_code=400, detail="query_required") from exc

    return success_response(
        result.to_dict(),
        "search_completed",
        {"category": category, "type": type},
    )
