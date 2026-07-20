import os
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def get_api_token() -> str | None:
    """Read API token from environment. None means dev mode (auth skipped)."""
    token = os.environ.get("PV_API_TOKEN", "").strip()
    return token or None


@dataclass(frozen=True)
class RuntimeDatabase:
    mode: str
    path: Path
    source: str


def resolve_runtime_database() -> RuntimeDatabase:
    configured = os.environ.get("PROJECT_VAULT_DATABASE_PATH")
    if configured:
        return RuntimeDatabase(os.environ.get("PROJECT_VAULT_RUNTIME_MODE", "explicit"), Path(configured), "environment")
    mode = os.environ.get("PROJECT_VAULT_RUNTIME_MODE")
    local_app_data = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    if mode == "desktop-production" or (not mode and getattr(sys, "frozen", False)):
        base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
        return RuntimeDatabase("desktop-production", base / "ProjectVault" / "database" / "project_vault.db", "local_app_data")
    if mode == "desktop-debug":
        base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
        return RuntimeDatabase("desktop-debug", base / "ProjectVaultDebug" / "database" / "project_vault.db", "local_app_data_debug")
    if mode == "test":
        raise RuntimeError("test mode requires PROJECT_VAULT_DATABASE_PATH")
    return RuntimeDatabase("backend-development", Path(__file__).resolve().parents[3] / "database" / "development" / "project_vault_dev.db", "development_default")


def default_database_path() -> Path:
    return resolve_runtime_database().path


class Settings(BaseSettings):
    app_name: str = "Project Vault"
    api_prefix: str = "/api/v1"
    database_path: Path = default_database_path()
    cors_origins: list[str] = [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
    ]

    model_config = SettingsConfigDict(
        env_prefix="PROJECT_VAULT_",
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
