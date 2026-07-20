import asyncio
import logging
import os
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
from app.api.knowledge import router as knowledge_router
from app.api.materials import router as materials_router
from app.api.projects import router as projects_router
from app.api.scanner import router as scanner_router
from app.api.providers import router as providers_router
from app.api.search import router as search_router
from app.api.settings import router as settings_router
from app.api.system import router as system_router
from app.core.config import get_api_token, get_settings, resolve_runtime_database
from app.db.database import connect, get_user_version, initialize_database
from app.services.settings import settings_get
from app.services.system import ScannerState, set_scanner_state
from app.watcher.processor import run_watcher_loop
from app.watcher.queue import DebouncedEventQueue
from app.watcher.service import FileWatcherService

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    runtime_database = resolve_runtime_database()
    with connect() as connection:
        schema_version = get_user_version(connection)
    logger.info("Project Vault v2.0.0")
    logger.info("Runtime mode: %s", runtime_database.mode)
    logger.info("Database source: %s", runtime_database.source)
    logger.info("Database path: %s", runtime_database.path.resolve())
    logger.info("Schema version: %s", schema_version)
    # Start file watcher if root_path is configured
    watcher_service: FileWatcherService | None = None
    processor_task: asyncio.Task | None = None
    state: ScannerState | None = None

    current_settings = settings_get()
    root_path = current_settings.get("root_path", "")
    if root_path and current_settings.get("auto_scan", True):
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
                    run_watcher_loop(
                        event_queue,
                        scan_cooldown=float(current_settings.get("scan_interval", 60)),
                        scanner_state=state,
                    )
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
    app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

    # CORS: restrict to specific frontend port in production, permissive in dev
    _frontend_port = os.environ.get("PV_FRONTEND_PORT", "")
    if _frontend_port:
        _cors_regex = rf"^https?://(127\.0\.0\.1|localhost):{_frontend_port}$"
    else:
        _cors_regex = r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$"
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=_cors_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # B10: Simple rate limiter (100 requests per minute per IP)
    rate_limit_store: dict[str, list[float]] = defaultdict(list)
    RATE_LIMIT = 100
    RATE_WINDOW = 60.0
    _rate_last_cleanup: list[float] = [0.0]
    RATE_CLEANUP_INTERVAL = 300.0

    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        # Periodic global cleanup of stale IPs to prevent memory growth
        if now - _rate_last_cleanup[0] > RATE_CLEANUP_INTERVAL:
            _rate_last_cleanup[0] = now
            dead_keys = [k for k, v in rate_limit_store.items() if not v or now - v[-1] > RATE_WINDOW]
            for k in dead_keys:
                del rate_limit_store[k]
        # Clean old entries for this IP
        rate_limit_store[client_ip] = [t for t in rate_limit_store[client_ip] if now - t < RATE_WINDOW]
        if len(rate_limit_store[client_ip]) >= RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"status": "error", "message": "rate_limit_exceeded", "data": None, "meta": {}},
            )
        rate_limit_store[client_ip].append(now)
        response = await call_next(request)
        return response

    # Security: Bearer token auth (active when PV_API_TOKEN is set)
    _api_token = get_api_token()
    _public_paths = {f"{settings.api_prefix}/health"}

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if _api_token is None:
            return await call_next(request)
        if request.url.path in _public_paths:
            return await call_next(request)
        auth_header = request.headers.get("Authorization", "")
        if auth_header != f"Bearer {_api_token}":
            return JSONResponse(
                status_code=401,
                content={"status": "error", "message": "unauthorized", "data": None, "meta": {}},
            )
        return await call_next(request)

    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)
    app.include_router(projects_router, prefix=settings.api_prefix)
    app.include_router(knowledge_router, prefix=settings.api_prefix)
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
