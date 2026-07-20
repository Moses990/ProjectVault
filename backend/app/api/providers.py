from fastapi import APIRouter, HTTPException
from pydantic import AliasChoices, BaseModel, Field

from app.api.response import success_response
from app.core_api import (
    create_ai_provider,
    delete_ai_provider,
    list_ai_providers,
    list_provider_models,
    preview_provider_models,
    test_ai_provider,
    update_ai_provider,
)
from app.db.database import get_database_path

router = APIRouter(prefix="/providers", tags=["ai-providers"])


class CreateProviderRequest(BaseModel):
    name: str
    base_url: str
    default_model: str = ""
    api_key: str = Field(default="", validation_alias=AliasChoices("api_key", "key_reference"))
    auth_mode: str = "api_key"
    is_enabled: bool = True


class UpdateProviderRequest(BaseModel):
    name: str | None = None
    base_url: str | None = None
    default_model: str | None = None
    is_enabled: bool | None = None
    api_key: str | None = Field(default=None, validation_alias=AliasChoices("api_key", "key_reference"))
    auth_mode: str | None = None
    clear_api_key: bool = False


class PreviewModelsRequest(BaseModel):
    base_url: str
    api_key: str = ""


def _provider_error(exc: ValueError) -> HTTPException:
    detail = str(exc)
    return HTTPException(status_code=404 if detail == "provider_not_found" else 400, detail=detail)


@router.get("")
def get_providers() -> dict[str, object]:
    return success_response(list_ai_providers(db_path=get_database_path()), "providers_listed")


@router.post("")
def post_provider(request: CreateProviderRequest) -> dict[str, object]:
    try:
        data = create_ai_provider(
            request.name,
            request.base_url,
            default_model=request.default_model,
            api_key=request.api_key,
            auth_mode=request.auth_mode,
            is_enabled=request.is_enabled,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return success_response(data, "provider_created")


@router.put("/{provider_id}")
def put_provider(provider_id: str, request: UpdateProviderRequest) -> dict[str, object]:
    try:
        data = update_ai_provider(
            provider_id,
            name=request.name,
            base_url=request.base_url,
            default_model="" if request.default_model is None and "default_model" in request.model_fields_set else request.default_model,
            is_enabled=request.is_enabled,
            api_key=request.api_key,
            auth_mode=request.auth_mode,
            clear_api_key=request.clear_api_key,
            db_path=get_database_path(),
        )
    except ValueError as exc:
        detail = str(exc)
        status_code = 404 if detail == "provider_not_found" else 422 if detail == "api_key_clear_conflict" else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return success_response(data, "provider_updated")


@router.delete("/{provider_id}")
def delete_provider(provider_id: str) -> dict[str, object]:
    try:
        data = delete_ai_provider(provider_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "provider_deleted")


@router.post("/{provider_id}/test")
def post_provider_test(provider_id: str) -> dict[str, object]:
    try:
        data = test_ai_provider(provider_id, db_path=get_database_path())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return success_response(data, "provider_tested")


@router.get("/{provider_id}/models")
def get_provider_models(provider_id: str) -> dict[str, object]:
    try:
        data = list_provider_models(provider_id, db_path=get_database_path())
    except ValueError as exc:
        raise _provider_error(exc) from exc
    return success_response(data, "provider_models_listed")


@router.post("/models/preview")
def post_provider_models_preview(request: PreviewModelsRequest) -> dict[str, object]:
    try:
        data = preview_provider_models(request.base_url, request.api_key)
    except ValueError as exc:
        raise _provider_error(exc) from exc
    return success_response(data, "provider_models_previewed")
