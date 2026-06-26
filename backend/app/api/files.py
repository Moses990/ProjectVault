from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.api.response import page_meta, success_response
from app.core_api import get_project_file_tree, list_project_files
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


@router.get("/{project_id}/file-tree")
def get_project_file_tree_endpoint(project_id: str) -> dict[str, object]:
    try:
        tree = get_project_file_tree(project_id, db_path=get_database_path())
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "project_not_found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(tree, "file_tree")


@router.get("/{project_id}/files/export")
def export_project_files_csv(project_id: str) -> StreamingResponse:
    """Export project file list as CSV."""
    import csv
    import io

    try:
        items, total, _, _ = list_project_files(
            project_id,
            page=1,
            limit=10000,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "project_not_found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["file_name", "relative_dir", "extension", "size_bytes", "last_modified"])
    for item in items:
        writer.writerow([
            item.get("file_name", ""),
            item.get("relative_dir", ""),
            item.get("extension", ""),
            item.get("size_bytes", 0),
            item.get("last_modified", ""),
        ])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=project_{project_id}_files.csv"},
    )
