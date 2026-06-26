from fastapi import APIRouter, HTTPException

from app.api.response import page_meta, success_response
from app.core_api import drawing_versions, drawings_center, list_project_drawings
from app.db.database import get_database_path

router = APIRouter(tags=["drawings"])


@router.get("/projects/{project_id}/drawings")
def get_project_drawings(
    project_id: str,
    category: str | None = None,
) -> dict[str, object]:
    try:
        items = list_project_drawings(
            project_id,
            category=category,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(items, "project_drawings")


@router.get("/drawings/center")
def get_drawings_center(
    page: int = 1,
    limit: int = 50,
    sort_by: str = "last_modified",
    category: str | None = None,
    q: str | None = None,
) -> dict[str, object]:
    try:
        items, total, resolved_page, resolved_limit = drawings_center(
            page=page,
            limit=limit,
            sort_by=sort_by,
            category=category,
            q=q,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success_response(
        items,
        "drawings_center",
        page_meta(resolved_page, resolved_limit, total),
    )


@router.get("/drawings/{drawing_id}/versions")
def get_drawing_versions(drawing_id: str) -> dict[str, object]:
    try:
        data = drawing_versions(drawing_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "drawing_versions")
