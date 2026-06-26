from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.response import page_meta, success_response
from app.core_api import (
    list_projects,
    project_ai_metadata,
    project_overview,
    set_project_favorite,
)
from app.db.database import get_database_path
from app.projects.discovery import discover_project_candidates
from app.projects.initializer import initialize_projects, result_to_dict

router = APIRouter(prefix="/projects", tags=["projects"])


class InitializeProjectsRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)
    default_tags: list[str] = Field(default_factory=list)


class FavoriteRequest(BaseModel):
    is_favorite: bool


@router.get("/candidates")
def get_project_candidates(root_path: str) -> dict[str, object]:
    try:
        candidates = discover_project_candidates(Path(root_path))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=403, detail="root_path_unreadable") from exc
    return success_response([item.__dict__ for item in candidates])


@router.post("/initialize")
def post_initialize_projects(request: InitializeProjectsRequest) -> dict[str, object]:
    if not request.paths:
        raise HTTPException(status_code=400, detail="paths_required")
    result = initialize_projects(request.paths, default_tags=request.default_tags)
    return success_response(result_to_dict(result), "projects_initialized")


@router.get("")
def get_projects(
    q: str | None = None,
    type: str | None = None,
    phase: str | None = None,
    page: int = 1,
    limit: int = 50,
    sort_by: str = "last_updated_at",
    order: str = "desc",
) -> dict[str, object]:
    try:
        items, total, resolved_page, resolved_limit = list_projects(
            q=q,
            project_type=type,
            phase=phase,
            page=page,
            limit=limit,
            sort_by=sort_by,
            order=order,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success_response(items, "projects_listed", page_meta(resolved_page, resolved_limit, total))


@router.post("/{project_id}/favorite")
def post_project_favorite(
    project_id: str,
    request: FavoriteRequest,
) -> dict[str, object]:
    try:
        data = set_project_favorite(
            project_id,
            request.is_favorite,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "favorite_updated")


@router.get("/{project_id}/overview")
def get_project_overview(project_id: str) -> dict[str, object]:
    try:
        data = project_overview(project_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "project_overview")


@router.get("/{project_id}/ai-metadata")
def get_project_ai_metadata(project_id: str) -> dict[str, object]:
    try:
        data = project_ai_metadata(project_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "project_ai_metadata")
