from fastapi import APIRouter

from app.api.response import success_response
from app.core_api import dashboard_metrics, dashboard_summary, recent_projects
from app.db.database import get_database_path

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_dashboard_summary() -> dict[str, object]:
    return success_response(
        dashboard_summary(db_path=get_database_path()),
        "dashboard_summary",
    )


@router.get("/metrics")
def get_dashboard_metrics() -> dict[str, object]:
    return success_response(
        dashboard_metrics(db_path=get_database_path()),
        "dashboard_metrics",
    )


@router.get("/recent-projects")
def get_recent_projects(limit: int = 10) -> dict[str, object]:
    return success_response(
        recent_projects(limit=limit, db_path=get_database_path()),
        "recent_projects",
    )
