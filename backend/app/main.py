import asyncio
from contextlib import asynccontextmanager
from collections import defaultdict
import time

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
from app.services.settings import settings_get
from app.services.system import ScannerState, set_scanner_state
from app.watcher.processor import run_watcher_loop
from app.watcher.queue import DebouncedEventQueue
from app.watcher.service import FileWatcherService


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()

    # Start file watcher if root_path is configured
    watcher_service: FileWatcherService | None = None
    processor_task: asyncio.Task | None = None
    state: ScannerState | None = None

    current_settings = settings_get()
    root_path = current_settings.get("root_path", "")
    if root_path:
        from pathlib import Path

        root = Path(root_path)
        if root.exists() and root.is_dir():
            event_queue = DebouncedEventQueue()
            watcher_service = FileWatcherService(event_queue)
            state = ScannerState()
            state.status = "IDLE"
            set_scanner_state(state)
            try:
                watcher_service.start(root)
                processor_task = asyncio.create_task(
                    run_watcher_loop(event_queue, scanner_state=state)
                )
            except Exception:
                watcher_service = None
                state = None
                set_scanner_state(None)

    yield

    # Shutdown watcher
    if processor_task is not None:
        processor_task.cancel()
        try:
            await processor_task
        except asyncio.CancelledError:
            pass
    if watcher_service is not None:
        watcher_service.stop()
    set_scanner_state(None)


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

    # B10: Simple rate limiter (100 requests per minute per IP)
    rate_limit_store: dict[str, list[float]] = defaultdict(list)
    RATE_LIMIT = 100
    RATE_WINDOW = 60.0

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Clean old entries
        rate_limit_store[client_ip] = [t for t in rate_limit_store[client_ip] if now - t < RATE_WINDOW]
        if len(rate_limit_store[client_ip]) >= RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"status": "error", "message": "rate_limit_exceeded", "data": None, "meta": {}},
            )
        rate_limit_store[client_ip].append(now)
        response = await call_next(request)
        return response

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
