import json
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path

from app.db.database import connect
from app.projects.project_structure import (
    EXISTING_PROJECT,
    NON_PROJECT_DIRECTORY,
    SUSPECTED_SUBDIRECTORY,
    classify_project_directory,
)


@dataclass(frozen=True)
class SkippedProject:
    path: str
    reason: str


@dataclass(frozen=True)
class InitializeProjectsResult:
    initialized_count: int
    project_ids: list[str]
    skipped: list[SkippedProject]


def build_default_project_json(project_dir: Path, default_tags: list[str]) -> dict[str, object]:
    project_id = str(uuid.uuid4())
    return {
        "project_id": project_id,
        "name": project_dir.name,
        "type": "",
        "phase": "",
        "status": "healthy",
        "manager": "",
        "tags": default_tags,
        "ai": {
            "summary": "",
            "core_needs": [],
            "special_reqs": [],
            "risks": [],
            "lessons": [],
        },
        "schema_version": 1,
    }


def write_project_json(project_dir: Path, data: dict[str, object]) -> None:
    target = project_dir / "project.json"
    temp = project_dir / "project.json.tmp"
    temp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temp.replace(target)


def insert_project_record(project_dir: Path, data: dict[str, object], db_path: Path | None) -> None:
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO projects (
                id,
                project_path,
                name,
                type,
                phase,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(data["project_id"]),
                str(project_dir.resolve()),
                str(data["name"]),
                str(data["type"]),
                str(data["phase"]),
                str(data["status"]),
            ),
        )
        for tag_name in data["tags"]:
            conn.execute(
                """
                INSERT OR IGNORE INTO project_tags (project_id, tag_name)
                VALUES (?, ?)
                """,
                (str(data["project_id"]), str(tag_name)),
            )


def initialize_projects(
    paths: list[str | Path],
    db_path: Path | None = None,
    default_tags: list[str] | None = None,
    confirmed_paths: list[str | Path] | None = None,
) -> InitializeProjectsResult:
    tags = default_tags or []
    confirmations = {
        str(Path(path).expanduser().resolve()) for path in (confirmed_paths or [])
    }
    initialized_ids: list[str] = []
    skipped: list[SkippedProject] = []

    for raw_path in paths:
        project_dir = Path(raw_path).expanduser().resolve()
        if not project_dir.exists() or not project_dir.is_dir():
            skipped.append(SkippedProject(path=str(project_dir), reason="path_invalid"))
            continue
        structure = classify_project_directory(project_dir)
        if structure.category == SUSPECTED_SUBDIRECTORY:
            skipped.append(
                SkippedProject(path=str(project_dir), reason="standard_project_directory")
            )
            continue
        if structure.category == NON_PROJECT_DIRECTORY:
            skipped.append(
                SkippedProject(path=str(project_dir), reason="non_project_directory")
            )
            continue
        if structure.category == EXISTING_PROJECT:
            skipped.append(
                SkippedProject(path=str(project_dir), reason="project_json_exists")
            )
            continue
        if structure.requires_confirmation and str(project_dir) not in confirmations:
            skipped.append(SkippedProject(path=str(project_dir), reason="confirmation_required"))
            continue

        data = build_default_project_json(project_dir, tags)
        write_project_json(project_dir, data)
        insert_project_record(project_dir, data, db_path)
        initialized_ids.append(str(data["project_id"]))

    return InitializeProjectsResult(
        initialized_count=len(initialized_ids),
        project_ids=initialized_ids,
        skipped=skipped,
    )


def result_to_dict(result: InitializeProjectsResult) -> dict[str, object]:
    return {
        "initialized_count": result.initialized_count,
        "project_ids": result.project_ids,
        "skipped": [asdict(item) for item in result.skipped],
    }
