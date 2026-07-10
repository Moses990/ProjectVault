"""Backward-compatible re-export layer.

All business logic has been moved to app.services.* domain modules.
This file re-exports every public symbol so that existing API route
imports (``from app.core_api import ...``) keep working unchanged.
"""

from app.services import (
    MAX_LIMIT,
    ResolvedAsset,
    clamp_limit,
    clamp_page,
    ensure_project_exists,
    parse_json_list,
    row_to_dict,
)
from app.services.ai_providers import (
    create_ai_provider,
    delete_ai_provider,
    list_ai_providers,
    test_ai_provider,
    update_ai_provider,
)
from app.services.drawings import (
    drawing_versions,
    drawings_center,
    list_project_drawings,
    list_project_materials,
)
from app.services.files import (
    get_project_file_tree,
    list_project_files,
    open_explorer_target,
    read_asset_text,
    resolve_asset,
)
from app.services.projects import (
    dashboard_metrics,
    list_projects,
    project_ai_metadata,
    project_overview,
    recent_projects,
    set_project_favorite,
)
from app.services.settings import (
    history_list,
    settings_get,
    settings_put,
)
from app.services.system import (
    create_database_backup,
    rebuild_indexes,
    restore_database_backup,
    run_database_maintenance,
    scan_project_by_id,
    scanner_status,
)
