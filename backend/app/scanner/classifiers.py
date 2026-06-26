import re
from pathlib import Path


DRAWING_EXTENSIONS = {".dwg"}
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


def is_drawing(path: Path) -> bool:
    return path.suffix.lower() in DRAWING_EXTENSIONS


def material_type(path: Path) -> str | None:
    return MATERIAL_EXTENSIONS.get(path.suffix.lower())


def drawing_category(path: Path) -> str:
    name = path.stem.lower()
    if any(token in name for token in ("plan", "floor", "平面")):
        return "PLAN"
    if any(token in name for token in ("elevation", "立面")):
        return "ELEVATION"
    if any(token in name for token in ("ceiling", "天花", "天花板")):
        return "CEILING"
    if any(token in name for token in ("detail", "node", "节点", "大样")):
        return "DETAIL"
    if any(token in name for token in ("construction", "construct", "施工", "构造")):
        return "CONSTRUCTION"
    return "UNKNOWN"


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