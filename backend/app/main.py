from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.assets import router as assets_router
from app.api.dashboard import router as dashboard_router
from app.api.drawings import router as drawings_router
from app.api.files import router as files_router
from app.api.health import router as health_router
from app.api.history import router as history_router
from app.api.materials import router as materials_router
from app.api.projects import router as projects_router
from app.api.scanner import router as scanner_router
from app.api.providers import router as providers_router
from app.api.search import router as search_router
from app.api.settings import router as settings_router
from app.api.system import router as system_router
from app.core.config import get_settings
from app.db.database import initialize_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)
    app.include_router(projects_router, prefix=settings.api_prefix)
    app.include_router(files_router, prefix=settings.api_prefix)
    app.include_router(drawings_router, prefix=settings.api_prefix)
    app.include_router(materials_router, prefix=settings.api_prefix)
    app.include_router(assets_router, prefix=settings.api_prefix)
    app.include_router(search_router, prefix=settings.api_prefix)
    app.include_router(settings_router, prefix=settings.api_prefix)
    app.include_router(history_router, prefix=settings.api_prefix)
    app.include_router(scanner_router, prefix=settings.api_prefix)
    app.include_router(providers_router, prefix=settings.api_prefix)
    app.include_router(system_router, prefix=settings.api_prefix)
    return app


app = create_app()
