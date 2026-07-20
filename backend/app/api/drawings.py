from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

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
    project_id: str | None = None,
) -> dict[str, object]:
    try:
        items, total, resolved_page, resolved_limit, category_counts = drawings_center(
            page=page,
            limit=limit,
            sort_by=sort_by,
            category=category,
            q=q,
            project_id=project_id,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    meta = page_meta(resolved_page, resolved_limit, total)
    meta["category_counts"] = category_counts
    return success_response(
        items,
        "drawings_center",
        meta,
    )


@router.get("/drawings/{drawing_id}/versions")
def get_drawing_versions(drawing_id: str) -> dict[str, object]:
    try:
        data = drawing_versions(drawing_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "drawing_versions")


@router.get("/projects/{project_id}/drawings/export")
def export_project_drawings_csv(project_id: str) -> StreamingResponse:
    """Export project drawing list as CSV."""
    import csv
    import io

    try:
        items = list_project_drawings(project_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["file_name", "relative_path", "dwg_category", "version_group", "version_number", "is_current", "last_modified"])
    for item in items:
        writer.writerow([
            item.get("file_name", ""),
            item.get("relative_path", ""),
            item.get("dwg_category", ""),
            item.get("version_group", ""),
            item.get("version_number", ""),
            "是" if item.get("is_current") else "否",
            item.get("last_modified", ""),
        ])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=project_{project_id}_drawings.csv"},
    )
