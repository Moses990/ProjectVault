from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.response import success_response
from app.core_api import rebuild_indexes, scan_project_by_id, scanner_status
from app.db.database import get_database_path

router = APIRouter(prefix="/scanner", tags=["scanner"])


class ScanProjectRequest(BaseModel):
    project_id: str


@router.get("/status")
def get_scanner_status() -> dict[str, object]:
    return success_response(scanner_status(), "scanner_status")


@router.post("/scan")
def post_scanner_scan(request: ScanProjectRequest) -> dict[str, object]:
    try:
        data = scan_project_by_id(request.project_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "scanner_scan_completed")


@router.post("/rebuild")
def post_scanner_rebuild(confirm: bool = False) -> dict[str, object]:
    if not confirm:
        raise HTTPException(status_code=400, detail="confirm_required")
    data = rebuild_indexes(db_path=get_database_path())
    return success_response(data, "scanner_rebuild_completed")
