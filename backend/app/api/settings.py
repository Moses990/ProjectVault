from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.response import success_response
from app.core_api import settings_get, settings_put
from app.db.database import get_database_path

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsRequest(BaseModel):
    root_path: str = ""
    scan_interval: int = 60
    theme: str = "system"


@router.get("")
def get_settings_api() -> dict[str, object]:
    return success_response(settings_get(db_path=get_database_path()), "settings")


@router.put("")
def put_settings_api(request: SettingsRequest) -> dict[str, object]:
    try:
        data = settings_put(request.model_dump(), db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success_response(data, "settings_updated")
