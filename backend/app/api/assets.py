import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, PlainTextResponse

from app.core_api import read_asset_text, resolve_asset
from app.db.database import get_database_path

router = APIRouter(prefix="/assets", tags=["assets"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg"}
THUMBNAIL_CACHE = Path(tempfile.gettempdir()) / "project-vault-thumbnails"
THUMBNAIL_CACHE.mkdir(exist_ok=True)


def _get_thumbnail_path(file_id: str, size: int) -> Path:
    return THUMBNAIL_CACHE / f"{file_id}_{size}.jpg"


def _generate_thumbnail(asset_path: Path, size: int) -> Path:
    from PIL import Image

    thumb_path = _get_thumbnail_path(asset_path.stem, size)
    if thumb_path.exists():
        return thumb_path

    img = Image.open(asset_path)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    img.save(thumb_path, "JPEG", quality=85)
    return thumb_path


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
def get_asset_thumbnail(file_id: str, size: int = Query(200, ge=32, le=800)) -> FileResponse:
    try:
        asset = resolve_asset(file_id, db_path=get_database_path())
    except ValueError as exc:
        detail = str(exc)
        status_code = 403 if detail == "file_outside_project" else 404
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if asset.path.suffix.lower() not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=404, detail="not_an_image")

    try:
        thumb_path = _generate_thumbnail(asset.path, size)
    except Exception:
        raise HTTPException(status_code=500, detail="thumbnail_generation_failed")

    return FileResponse(thumb_path, media_type="image/jpeg")


@router.get("/{file_id}/text")
def get_asset_text(file_id: str) -> PlainTextResponse:
    try:
        content, encoding = read_asset_text(file_id, db_path=get_database_path())
    except ValueError as exc:
        detail = str(exc)
        if detail == "file_outside_project":
            raise HTTPException(status_code=403, detail=detail) from exc
        raise HTTPException(status_code=404, detail=detail) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return PlainTextResponse(content, media_type=f"text/plain; charset={encoding}")
