from dataclasses import dataclass
import os
from pathlib import Path

from app.projects.project_structure import (
    analyze_project_directory,
    looks_like_project_root,
)


@dataclass(frozen=True)
class ProjectCandidate:
    folder_name: str
    absolute_path: str
    created_at: str | None
    estimated_files: int
    category: str
    candidate_type: str
    confidence: str
    evidence: tuple[str, ...]
    warnings: tuple[str, ...]
    selectable: bool
    requires_confirmation: bool
    will_write_project_json: bool


def estimate_files(path: Path) -> int:
    try:
        return sum(len(files) for _current, _directories, files in os.walk(path, followlinks=False))
    except OSError:
        return 0


def discover_project_candidates(root_path: str | Path) -> list[ProjectCandidate]:
    root = Path(root_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError("root_path_invalid")
    if (root / "project.json").exists():
        raise ValueError("root_path_is_project")
    if looks_like_project_root(root):
        raise ValueError("root_path_looks_like_project")

    candidates: list[ProjectCandidate] = []
    for child in sorted(root.iterdir(), key=lambda item: item.name.lower()):
        if not child.is_dir():
            continue
        analysis = analyze_project_directory(child)
        candidates.append(
            ProjectCandidate(
                folder_name=child.name,
                absolute_path=str(child.resolve()),
                created_at=None,
                estimated_files=estimate_files(child),
                category=analysis.category,
                candidate_type=analysis.candidate_type,
                confidence=analysis.confidence,
                evidence=analysis.evidence,
                warnings=analysis.warnings,
                selectable=analysis.selectable,
                requires_confirmation=analysis.requires_confirmation,
                will_write_project_json=analysis.will_write_project_json,
            )
        )
    return candidates
