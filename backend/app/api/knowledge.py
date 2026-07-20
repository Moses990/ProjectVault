from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.response import success_response
from app.db.database import get_database_path
from app.knowledge.service import apply_knowledge_draft, create_knowledge_draft, discard_knowledge_draft, extract_text_sources, get_knowledge, list_knowledge_history

router = APIRouter(prefix="/projects/{project_id}/knowledge", tags=["knowledge"])


class ExtractTextRequest(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    limit: int = 20


class CreateDraftRequest(BaseModel):
    source_ids: list[str] = Field(default_factory=list)
    mode: str = "manual"
    draft: dict[str, object] | None = None
    provider_id: str | None = None
    model_id: str | None = None


class ApplyDraftRequest(BaseModel):
    draft_id: str
    fields: list[str] = Field(default_factory=list)
    confirm: bool = False


@router.get("")
def get_project_knowledge(project_id: str) -> dict[str, object]:
    try:
        data = get_knowledge(project_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "project_knowledge")


@router.post("/extract-text")
def post_knowledge_extract_text(
    project_id: str,
    request: ExtractTextRequest,
) -> dict[str, object]:
    try:
        data = extract_text_sources(
            project_id,
            request.file_ids,
            limit=request.limit,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "project_not_found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "knowledge_text_extracted")


@router.post("/draft")
def post_knowledge_draft(
    project_id: str,
    request: CreateDraftRequest,
) -> dict[str, object]:
    try:
        data = create_knowledge_draft(
            project_id,
            source_ids=request.source_ids,
            mode=request.mode,
            draft=request.draft,
            provider_id=request.provider_id,
            model_id=request.model_id,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "project_not_found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(data, "knowledge_draft_created")


@router.post("/apply")
def post_knowledge_apply(
    project_id: str,
    request: ApplyDraftRequest,
) -> dict[str, object]:
    try:
        data = apply_knowledge_draft(
            project_id,
            draft_id=request.draft_id,
            fields=request.fields,
            confirm=request.confirm,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail in {"project_not_found", "draft_not_found", "project_json_missing"} else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(data, "knowledge_draft_applied")


@router.post("/draft/{draft_id}/discard")
def post_knowledge_discard(project_id: str, draft_id: str) -> dict[str, object]:
    try:
        data = discard_knowledge_draft(project_id, draft_id=draft_id, db_path=get_database_path())
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail in {"project_not_found", "draft_not_found"} else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(data, "knowledge_draft_discarded")


@router.get("/history")
def get_knowledge_history(project_id: str, limit: int = 20, offset: int = 0) -> dict[str, object]:
    try:
        data = list_knowledge_history(
            project_id,
            limit=limit,
            offset=offset,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "project_not_found" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(data, "knowledge_history")
