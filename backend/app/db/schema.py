CURRENT_SCHEMA_VERSION = 3

SCHEMA_V1_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        project_hash TEXT,
        project_path TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        phase TEXT,
        status TEXT NOT NULL DEFAULT 'healthy',
        manager TEXT,
        file_count INTEGER NOT NULL DEFAULT 0,
        cad_count INTEGER NOT NULL DEFAULT 0,
        material_count INTEGER NOT NULL DEFAULT 0,
        last_updated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(project_path);",
    "CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);",
    "CREATE INDEX IF NOT EXISTS idx_projects_phase ON projects(phase);",
    "CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(type);",
    "CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(last_updated_at);",
    """
    CREATE INDEX IF NOT EXISTS idx_projects_phase_updated
    ON projects(phase, last_updated_at);
    """,
    """
    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_hash TEXT,
        relative_path TEXT NOT NULL,
        relative_dir TEXT,
        file_name TEXT NOT NULL,
        extension TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        last_modified TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, relative_path)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);",
    "CREATE INDEX IF NOT EXISTS idx_files_modified ON files(last_modified);",
    """
    CREATE INDEX IF NOT EXISTS idx_files_project_modified
    ON files(project_id, last_modified);
    """,
    """
    CREATE TABLE IF NOT EXISTS drawings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL UNIQUE,
        dwg_category TEXT,
        version_group TEXT,
        version_number INTEGER,
        is_current INTEGER NOT NULL DEFAULT 1,
        parent_drawing_id TEXT,
        last_modified TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_drawing_id) REFERENCES drawings(id) ON DELETE SET NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_drawings_category ON drawings(dwg_category);",
    "CREATE INDEX IF NOT EXISTS idx_drawings_project ON drawings(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_drawings_version_group ON drawings(version_group);",
    """
    CREATE INDEX IF NOT EXISTS idx_drawings_group_modified
    ON drawings(version_group, last_modified);
    """,
    """
    CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL UNIQUE,
        material_type TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(material_type);",
    "CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);",
    """
    CREATE TABLE IF NOT EXISTS ai_metadata (
        project_id TEXT PRIMARY KEY,
        summary TEXT,
        core_needs TEXT,
        special_reqs TEXT,
        risks TEXT,
        lessons TEXT,
        provider_name TEXT,
        model_name TEXT,
        generated_at TEXT,
        metadata_version TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS project_tags (
        project_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, tag_name)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_project_tags_name ON project_tags(tag_name);",
    """
    CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        default_model TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        key_reference TEXT
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_provider_enabled ON ai_providers(is_enabled);",
    """
    CREATE TABLE IF NOT EXISTS scan_history (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        event_type TEXT NOT NULL,
        duration_ms INTEGER,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        scanner_version TEXT,
        affected_files INTEGER,
        message TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_history_project ON scan_history(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_history_type ON scan_history(event_type);",
    "CREATE INDEX IF NOT EXISTS idx_history_created ON scan_history(created_at);",
    """
    CREATE INDEX IF NOT EXISTS idx_history_project_created
    ON scan_history(project_id, created_at);
    """,
    """
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        category TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS favorites (
        identity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(identity_type, entity_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_global USING fts5(
        entity_id,
        entity_type,
        title,
        content,
        project_id
    );
    """,
]

SCHEMA_V2_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_id TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        extractor TEXT NOT NULL,
        text_hash TEXT NOT NULL,
        text_excerpt TEXT,
        text_length INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ready',
        error_message TEXT,
        extracted_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
        UNIQUE(project_id, file_id)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_knowledge_sources_project ON knowledge_sources(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_knowledge_sources_file ON knowledge_sources(file_id);",
    """
    CREATE TABLE IF NOT EXISTS knowledge_drafts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        draft_json TEXT NOT NULL,
        provider_name TEXT,
        model_name TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_knowledge_drafts_project ON knowledge_drafts(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_knowledge_drafts_status ON knowledge_drafts(status);",
    """
    CREATE TABLE IF NOT EXISTS knowledge_history (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_knowledge_history_project ON knowledge_history(project_id);",
    "CREATE INDEX IF NOT EXISTS idx_knowledge_history_created ON knowledge_history(created_at);",
]
