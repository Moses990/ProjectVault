from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.response import success_response
from app.core_api import (
    audit_project_indexes,
    create_database_backup,
    open_explorer_target,
    rebuild_project_indexes,
    restore_database_backup,
    run_database_maintenance,
)
from app.services.settings import settings_get
from app.db.database import get_database_path

router = APIRouter(prefix="/system", tags=["system"])


class ExplorerOpenRequest(BaseModel):
    file_id: str
    mode: str


class MaintenanceRequest(BaseModel):
    now: str | None = None

    @classmethod
    def validate_now(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 50:
            raise ValueError("now_too_long")
        return v


class BackupRestoreRequest(BaseModel):
    name: str
    confirm: bool = False


class IndexMaintenanceRequest(BaseModel):
    root_path: str | None = None
    confirm: bool = False


def _root_path_or_setting(root_path: str | None) -> str:
    value = (root_path or "").strip()
    if value:
        return value
    configured = settings_get(db_path=get_database_path()).get("root_path", "")
    if not str(configured).strip():
        raise ValueError("root_path_not_configured")
    return str(configured)


@router.post("/explorer/open")
def post_explorer_open(request: ExplorerOpenRequest) -> dict[str, object]:
    try:
        data = open_explorer_target(
            request.file_id,
            request.mode,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 403 if detail == "file_outside_project" else 404
        if detail == "mode_invalid":
            status_code = 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return success_response(data, "explorer_opened")


@router.post("/maintenance/run")
def post_maintenance_run(request: MaintenanceRequest | None = None) -> dict[str, object]:
    data = run_database_maintenance(
        now=request.now if request else None,
        db_path=get_database_path(),
    )
    return success_response(data, "maintenance_completed")


@router.post("/backup/create")
def post_backup_create() -> dict[str, object]:
    data = create_database_backup(db_path=get_database_path())
    return success_response(data, "backup_created")


@router.post("/backup/restore")
def post_restore_backup(request: BackupRestoreRequest) -> dict[str, object]:
    try:
        data = restore_database_backup(
            request.name,
            confirm=request.confirm,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "backup_restored")


@router.post("/index/audit")
def post_index_audit(request: IndexMaintenanceRequest | None = None) -> dict[str, object]:
    try:
        root_path = _root_path_or_setting(request.root_path if request else None)
        data = audit_project_indexes(root_path=root_path, db_path=get_database_path())
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success_response(data, "index_audit_completed")


@router.post("/index/rebuild")
def post_index_rebuild(request: IndexMaintenanceRequest) -> dict[str, object]:
    try:
        root_path = _root_path_or_setting(request.root_path)
        data = rebuild_project_indexes(
            root_path=root_path,
            confirm=request.confirm,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return success_response(data, "index_rebuild_completed")
