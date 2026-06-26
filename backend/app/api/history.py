from fastapi import APIRouter

from app.api.response import page_meta, success_response
from app.core_api import history_list
from app.db.database import get_database_path

router = APIRouter(prefix="/history", tags=["history"])


@router.get("")
def get_history(
    page: int = 1,
    limit: int = 50,
    project_id: str | None = None,
) -> dict[str, object]:
    items, total, resolved_page, resolved_limit = history_list(
        project_id=project_id,
        page=page,
        limit=limit,
        db_path=get_database_path(),
    )
    return success_response(
        items,
        "history",
        page_meta(resolved_page, resolved_limit, total),
    )
