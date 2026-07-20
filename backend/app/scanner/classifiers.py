import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path


DRAWING_EXTENSIONS = {".dwg", ".dxf"}
MATERIAL_EXTENSIONS = {
    ".pdf": "pdf",
    ".xls": "excel",
    ".xlsx": "excel",
    ".csv": "excel",
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".webp": "image",
    ".doc": "word",
    ".docx": "word",
}

_VERSION_SUFFIX_PATTERNS = [
    re.compile(r"([_-])v(\d+)$", re.IGNORECASE),
    re.compile(r"([_-])final$", re.IGNORECASE),
    re.compile(r"([_-])最终$"),
    re.compile(r"([_-])rev[_-]?([a-zA-Z0-9]+)$", re.IGNORECASE),
    re.compile(r"([_-])\d{4}[-]?\d{2}[-]?\d{2}$"),
]

_CATEGORY_RULES = (
    ("GENERAL_PLAN", ("master plan", "general plan", "总平面", "总平", "总图", "总体", "总布置")),
    ("DOOR", ("door schedule", "door detail", "门表", "门图", "门节点")),
    ("MATERIAL_SCHEDULE", ("finish schedule", "material schedule", "材料清单", "材料表", "饰面表")),
    ("STRUCTURE", ("structural", "structure", "钢结构", "结构", "龙骨", "基础", "承重")),
    # ponytail: ceiling precedes MEP so "照明布置/灯具天花" stays an RCP drawing.
    ("CEILING", ("reflected ceiling", "ceiling", "照明布置", "灯具布置", "天花布置", "天花", "吊顶", "顶面", "rcp")),
    ("MEP", ("electrical", "plumbing", "hvac", "mep", "给排水", "强电", "弱电", "暖通", "空调", "消防", "电气", "照明", "电力", "水电")),
    ("FLOORING", ("floor finish", "flooring", "地坪", "地面", "铺装", "地材")),
    ("ELEVATION", ("elevation", "立面")),
    ("SECTION", ("section", "剖面", "剖视")),
    ("DETAIL", ("安装节点", "固定节点", "节点", "收口", "接口", "连接", "node", "detail")),
    ("ENLARGED", ("局部放大", "放大图", "大样", "详图")),
    ("ELEVATION", ("墙面", "展墙")),
    ("PLAN", ("floor plan", "layout", "平面布置", "家具布置", "功能布置", "平面", "平布", "plan")),
    ("CONSTRUCTION", ("construction", "construct", "施工", "构造")),
)


@dataclass(frozen=True)
class DrawingClassification:
    category: str
    matched_rule: str | None
    matched_keyword: str | None
    source: str | None


def is_drawing(path: Path) -> bool:
    return path.suffix.lower() in DRAWING_EXTENSIONS


def material_type(path: Path) -> str | None:
    return MATERIAL_EXTENSIONS.get(path.suffix.lower())


def _normalize_classification_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = re.sub(r"[＊*_—－-]+", " ", normalized)
    return " ".join(normalized.split())


def _match_category(value: str, source: str) -> DrawingClassification | None:
    for category, keywords in _CATEGORY_RULES:
        for keyword in keywords:
            if keyword in value:
                return DrawingClassification(category, category, keyword, source)
    return None


def classify_drawing(path: Path) -> DrawingClassification:
    filename = _normalize_classification_text(path.stem)
    filename_match = _match_category(filename, "filename")
    if filename_match:
        return filename_match

    if any(keyword in filename for keyword in ("图框", "图纸说明", "图纸目录", "设计说明")):
        return DrawingClassification("UNCLASSIFIED", None, None, None)

    # Callers pass a project-relative path, so project names never become evidence.
    for directory in reversed(path.parent.parts):
        directory_match = _match_category(_normalize_classification_text(directory), "directory")
        if directory_match:
            return directory_match
    return DrawingClassification("UNCLASSIFIED", None, None, None)


def drawing_category(path: Path) -> str:
    return classify_drawing(path).category


def _strip_version_suffix(stem: str) -> str:
    for pattern in _VERSION_SUFFIX_PATTERNS:
        stripped = pattern.sub("", stem)
        if stripped != stem:
            return stripped
    return stem


def _normalize_group(stem: str) -> str:
    group = re.sub(r"\s+", "_", stem.strip().lower())
    group = re.sub(r"[-_]+", "_", group)
    return group.strip("_")


def extract_version_group(filename: str) -> str | None:
    """Return the stable drawing group name with version suffix removed."""
    stem = Path(filename).stem
    group = _normalize_group(_strip_version_suffix(stem))
    return group or None


def guess_version_number(filename: str) -> int | None:
    """Return a sortable version number for common CAD filename suffixes."""
    name = Path(filename).stem

    match = re.search(r"[_-]v(\d+)$", name, re.IGNORECASE)
    if match:
        return int(match.group(1))

    if re.search(r"[_-]final$", name, re.IGNORECASE) or re.search(r"[_-]最终$", name):
        return 9999

    match = re.search(r"[_-]rev[_-]?([a-zA-Z0-9]+)$", name, re.IGNORECASE)
    if match:
        token = match.group(1).upper()
        if token.isdigit():
            return int(token)
        return 100 + (ord(token[0]) - ord("A") + 1)

    match = re.search(r"[_-](\d{4})[-]?(\d{2})[-]?(\d{2})$", name)
    if match:
        return int("".join(match.groups()))

    return None
