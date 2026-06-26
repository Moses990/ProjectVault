from fastapi import APIRouter, HTTPException

from app.api.response import success_response
from app.core_api import list_project_materials
from app.db.database import get_database_path

router = APIRouter(prefix="/projects", tags=["materials"])


@router.get("/{project_id}/materials")
def get_project_materials(
    project_id: str,
    material_type: str | None = None,
) -> dict[str, object]:
    try:
        items = list_project_materials(
            project_id,
            material_type=material_type,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(items, "project_materials")
