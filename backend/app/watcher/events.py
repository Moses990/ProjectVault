from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class FileEventType(StrEnum):
    CREATED = "created"
    MODIFIED = "modified"
    DELETED = "deleted"
    MOVED = "moved"


@dataclass(frozen=True)
class WatchEvent:
    event_type: FileEventType
    path: Path
    source_path: Path | None = None

    @property
    def dedupe_key(self) -> tuple[str, str]:
        if self.event_type == FileEventType.MOVED and self.source_path is not None:
            return (self.event_type.value, str(self.source_path))
        return ("path", str(self.path))


IGNORED_FILENAMES = {
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
}

IGNORED_SUFFIXES = {
    ".bak",
    ".sv$",
    ".ac$",
}

IGNORED_DIRECTORIES = {
    ".tmp",
    ".cache",
}


def should_ignore_path(path: Path) -> bool:
    parts = path.parts
    if any(part in IGNORED_DIRECTORIES for part in parts):
        return True

    name = path.name
    if name in IGNORED_FILENAMES:
        return True
    if name.startswith("~$") and path.suffix.lower() in {".docx", ".xlsx"}:
        return True

    lower_name = name.lower()
    return any(lower_name.endswith(suffix) for suffix in IGNORED_SUFFIXES)
