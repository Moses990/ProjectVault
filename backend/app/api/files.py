from fastapi import APIRouter, HTTPException

from app.api.response import page_meta, success_response
from app.core_api import list_project_files
from app.db.database import get_database_path

router = APIRouter(prefix="/projects", tags=["files"])


@router.get("/{project_id}/files")
def get_project_files(
    project_id: str,
    directory: str | None = None,
    extension: str | None = None,
    sort_by: str = "name",
    order: str = "asc",
    page: int = 1,
    limit: int = 50,
) -> dict[str, object]:
    try:
        items, total, resolved_page, resolved_limit = list_project_files(
            project_id,
            directory=directory,
            extension=extension,
            sort_by=sort_by,
            order=order,
            page=page,
            limit=limit,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "project_not_found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(
        items,
        "project_files",
        page_meta(resolved_page, resolved_limit, total),
    )
