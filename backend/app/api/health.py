from fastapi import APIRouter

from app.db.database import get_database_path

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, object]:
    database_path = get_database_path()
    return {
        "status": "ok",
        "service": "project-vault-backend",
        "database": {
            "path": str(database_path),
            "exists": database_path.exists(),
        },
    }
