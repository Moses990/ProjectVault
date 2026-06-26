from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProjectCandidate:
    folder_name: str
    absolute_path: str
    created_at: str | None
    estimated_files: int


def estimate_first_level_files(path: Path) -> int:
    try:
        return sum(1 for child in path.iterdir() if child.is_file())
    except OSError:
        return 0


def discover_project_candidates(root_path: str | Path) -> list[ProjectCandidate]:
    root = Path(root_path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError("root_path_invalid")

    candidates: list[ProjectCandidate] = []
    for child in sorted(root.iterdir(), key=lambda item: item.name.lower()):
        if not child.is_dir():
            continue
        if (child / "project.json").exists():
            continue
        candidates.append(
            ProjectCandidate(
                folder_name=child.name,
                absolute_path=str(child.resolve()),
                created_at=None,
                estimated_files=estimate_first_level_files(child),
            )
        )
    return candidates
