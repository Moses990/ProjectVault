from fastapi import APIRouter, HTTPException
from starlette.responses import FileResponse

from app.core_api import resolve_asset
from app.db.database import get_database_path

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/{file_id}/content")
def get_asset_content(file_id: str) -> FileResponse:
    try:
        asset = resolve_asset(file_id, db_path=get_database_path())
    except ValueError as exc:
        detail = str(exc)
        status_code = 403 if detail == "file_outside_project" else 404
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(asset.path, media_type=asset.media_type, filename=asset.path.name)


@router.get("/{file_id}/thumbnail")
def get_asset_thumbnail(file_id: str) -> FileResponse:
    try:
        resolve_asset(file_id, db_path=get_database_path())
    except ValueError as exc:
        detail = str(exc)
        status_code = 403 if detail == "file_outside_project" else 404
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=404, detail="thumbnail_not_generated")
