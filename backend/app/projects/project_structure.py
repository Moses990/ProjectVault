import json
import os
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


STANDARD_PROJECT_DIRECTORIES = frozenset(
    {
        "00_项目档案",
        "01_项目前期资料",
        "02_需求资料",
        "03_CAD图纸",
        "04_效果图",
        "05_汇报文件",
        "06_材料资料",
        "07_现场资料",
    }
)
PROJECT_ARCHIVE_DIRECTORY = "00_项目档案"
MIN_PROJECT_ROOT_DIRECTORIES = 3
NON_PROJECT_DIRECTORY_NAMES = frozenset(
    {
        "$recycle.bin",
        "system volume information",
        "node_modules",
        "__pycache__",
        ".git",
        ".svn",
    }
)
LOW_CONFIDENCE_SUBDIRECTORY_NAMES = frozenset(
    {"cad", "图纸", "施工图", "效果图", "材料", "汇报", "现场照片"}
)
DESIGN_EXTENSIONS = frozenset(
    {
        ".dwg",
        ".dxf",
        ".pdf",
        ".ppt",
        ".pptx",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".jpg",
        ".jpeg",
        ".png",
        ".tif",
        ".tiff",
    }
)
CONTENT_DIRECTORY_NAMES = frozenset(
    {
        "cad",
        "图纸",
        "施工图",
        "效果图",
        "方案",
        "汇报",
        "材料",
        "客户资料",
        "现场",
        "照片",
        "合同",
        "报价",
    }
)
CONTENT_DIRECTORY_NAMES_CASEFOLD = frozenset(item.casefold() for item in CONTENT_DIRECTORY_NAMES)
STANDARD_PROJECT_DIRECTORIES_CASEFOLD = frozenset(
    item.casefold() for item in STANDARD_PROJECT_DIRECTORIES
)
LOW_CONFIDENCE_SUBDIRECTORY_NAMES_CASEFOLD = frozenset(
    item.casefold() for item in LOW_CONFIDENCE_SUBDIRECTORY_NAMES
)

EXISTING_PROJECT = "existing_project"
PENDING_PROJECT = "pending_project"
SUSPECTED_SUBDIRECTORY = "suspected_subdirectory"
CONFIRMATION_REQUIRED = "confirmation_required"
NON_PROJECT_DIRECTORY = "non_project_directory"

INITIALIZED_PROJECT = "initialized_project"
STRUCTURED_PROJECT_CANDIDATE = "structured_project_candidate"
ORDINARY_PROJECT_CANDIDATE = "ordinary_project_candidate"
SUSPECTED_PROJECT_SUBDIRECTORY = "suspected_project_subdirectory"


@dataclass(frozen=True)
class DirectoryEvidence:
    file_count: int
    design_file_count: int
    extension_counts: dict[str, int]
    signal_directories: tuple[str, ...]
    unreadable: bool = False


@dataclass(frozen=True)
class CandidateAnalysis:
    category: str
    candidate_type: str
    confidence: str
    evidence: tuple[str, ...]
    warnings: tuple[str, ...]
    selectable: bool
    requires_confirmation: bool
    will_write_project_json: bool = False


@dataclass(frozen=True)
class ProjectStructure:
    category: str
    selectable: bool
    requires_confirmation: bool


def is_standard_project_directory(path: str | Path) -> bool:
    return Path(path).name.casefold() in STANDARD_PROJECT_DIRECTORIES_CASEFOLD


def standard_project_directories(path: str | Path) -> set[str]:
    directory = Path(path)
    try:
        return {
            child.name
            for child in directory.iterdir()
            if child.is_dir() and is_standard_project_directory(child)
        }
    except OSError:
        return set()


def is_non_project_directory(path: str | Path) -> bool:
    name = Path(path).name.casefold()
    return name.startswith(".") or name in NON_PROJECT_DIRECTORY_NAMES


def has_valid_project_json(path: str | Path) -> bool:
    project_json = Path(path) / "project.json"
    if not project_json.exists():
        return False
    try:
        data = json.loads(project_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return isinstance(data, dict) and bool(data.get("project_id") and data.get("name"))


def inspect_directory(path: str | Path) -> DirectoryEvidence:
    directory = Path(path)
    file_count = 0
    extension_counts: Counter[str] = Counter()
    signal_directories: set[str] = set()
    unreadable = False
    try:
        for _current, subdirectories, files in os.walk(directory, followlinks=False):
            subdirectories[:] = [name for name in subdirectories if not name.startswith(".")]
            signal_directories.update(
                name
                for name in subdirectories
                if name.casefold() in CONTENT_DIRECTORY_NAMES_CASEFOLD
            )
            for name in files:
                file_count += 1
                extension = Path(name).suffix.casefold()
                if extension in DESIGN_EXTENSIONS:
                    extension_counts[extension] += 1
    except OSError:
        unreadable = True
    return DirectoryEvidence(
        file_count=file_count,
        design_file_count=sum(extension_counts.values()),
        extension_counts=dict(extension_counts),
        signal_directories=tuple(sorted(signal_directories, key=str.casefold)),
        unreadable=unreadable,
    )


def _evidence_text(evidence: DirectoryEvidence) -> list[str]:
    items = ["项目库直属一级目录", f"包含 {evidence.file_count} 个文件"]
    if evidence.design_file_count:
        items.append(f"包含 {evidence.design_file_count} 个设计类文件")
    for extension, count in sorted(
        evidence.extension_counts.items(), key=lambda item: (-item[1], item[0])
    )[:4]:
        items.append(f"包含 {count} 个 {extension.lstrip('.').upper()} 文件")
    if evidence.signal_directories:
        items.append(f"包含 {', '.join(evidence.signal_directories[:4])} 目录")
    if evidence.unreadable:
        items.append("部分目录无法读取，统计结果可能不完整")
    return items


def analyze_project_directory(path: str | Path) -> CandidateAnalysis:
    directory = Path(path)
    evidence = inspect_directory(directory)
    evidence_text = _evidence_text(evidence)

    if is_non_project_directory(directory):
        return CandidateAnalysis(
            category=NON_PROJECT_DIRECTORY,
            candidate_type="non_project_directory",
            confidence="high",
            evidence=("隐藏目录或明确的系统/缓存目录",),
            warnings=("不会自动初始化",),
            selectable=False,
            requires_confirmation=False,
        )

    if is_standard_project_directory(directory):
        return CandidateAnalysis(
            category=SUSPECTED_SUBDIRECTORY,
            candidate_type=SUSPECTED_PROJECT_SUBDIRECTORY,
            confidence="high",
            evidence=("目录名称属于 Project Vault 标准资料目录",),
            warnings=("不会作为独立项目初始化",),
            selectable=False,
            requires_confirmation=False,
        )

    if (directory / "project.json").exists():
        if has_valid_project_json(directory):
            return CandidateAnalysis(
                category=EXISTING_PROJECT,
                candidate_type=INITIALIZED_PROJECT,
                confidence="high",
                evidence=("根目录存在有效 project.json",),
                warnings=(),
                selectable=False,
                requires_confirmation=False,
            )
        return CandidateAnalysis(
            category=EXISTING_PROJECT,
            candidate_type=CONFIRMATION_REQUIRED,
            confidence="low",
            evidence=("根目录存在 project.json，但内容未通过最小有效性检查",),
            warnings=("不会覆盖已有 project.json",),
            selectable=False,
            requires_confirmation=False,
        )

    if looks_like_project_root(directory):
        return CandidateAnalysis(
            category=PENDING_PROJECT,
            candidate_type=STRUCTURED_PROJECT_CANDIDATE,
            confidence="high",
            evidence=(
                f"命中 {len(standard_project_directories(directory))} 个标准项目目录",
                *evidence_text,
            ),
            warnings=("需要用户确认后初始化",),
            selectable=True,
            requires_confirmation=True,
        )

    strong_content = evidence.file_count >= 3 and (
        evidence.design_file_count >= 2 or len(evidence.signal_directories) >= 1
    )
    if directory.name.casefold() in LOW_CONFIDENCE_SUBDIRECTORY_NAMES_CASEFOLD:
        return CandidateAnalysis(
            category=CONFIRMATION_REQUIRED,
            candidate_type=SUSPECTED_PROJECT_SUBDIRECTORY,
            confidence="low",
            evidence=tuple(evidence_text),
            warnings=("目录名称可能是项目内部资料目录，需人工确认",),
            selectable=True,
            requires_confirmation=True,
        )

    if strong_content:
        score = 2
        if evidence.design_file_count >= 2:
            score += 1
        if len(evidence.extension_counts) >= 2:
            score += 1
        if evidence.signal_directories:
            score += 1
        if evidence.file_count >= 20:
            score += 1
        confidence = "high" if score >= 5 else "medium"
        return CandidateAnalysis(
            category=CONFIRMATION_REQUIRED,
            candidate_type=ORDINARY_PROJECT_CANDIDATE,
            confidence=confidence,
            evidence=tuple(evidence_text),
            warnings=("需要用户确认后初始化",),
            selectable=True,
            requires_confirmation=True,
        )

    return CandidateAnalysis(
        category=CONFIRMATION_REQUIRED,
        candidate_type=CONFIRMATION_REQUIRED,
        confidence="low",
        evidence=tuple(evidence_text),
        warnings=("当前证据不足，需人工确认",),
        selectable=True,
        requires_confirmation=True,
    )


def looks_like_project_root(path: str | Path) -> bool:
    names = standard_project_directories(path)
    return PROJECT_ARCHIVE_DIRECTORY in names and len(names) >= MIN_PROJECT_ROOT_DIRECTORIES


def classify_project_directory(path: str | Path) -> ProjectStructure:
    directory = Path(path)
    if is_non_project_directory(directory):
        return ProjectStructure(
            category=NON_PROJECT_DIRECTORY,
            selectable=False,
            requires_confirmation=False,
        )
    if is_standard_project_directory(directory):
        return ProjectStructure(
            category=SUSPECTED_SUBDIRECTORY,
            selectable=False,
            requires_confirmation=False,
        )
    if (directory / "project.json").exists():
        return ProjectStructure(
            category=EXISTING_PROJECT,
            selectable=False,
            requires_confirmation=False,
        )
    if looks_like_project_root(directory):
        return ProjectStructure(
            category=PENDING_PROJECT,
            selectable=True,
            requires_confirmation=True,
        )
    return ProjectStructure(
        category=CONFIRMATION_REQUIRED,
        selectable=True,
        requires_confirmation=True,
    )
