import os
import sys
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def default_database_path() -> Path:
    if getattr(sys, "frozen", False):
        local_app_data = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if local_app_data:
            return Path(local_app_data) / "ProjectVault" / "database" / "project_vault.db"
        return Path.home() / "AppData" / "Local" / "ProjectVault" / "database" / "project_vault.db"
    return Path(__file__).resolve().parents[3] / "database" / "project_vault.db"


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
