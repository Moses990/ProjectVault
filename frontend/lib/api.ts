declare global {
  interface Window {
    __BACKEND_PORT__?: number;
  }
}

export function backendPort(): number | null {
  return typeof window !== "undefined" && window.__BACKEND_PORT__
    ? window.__BACKEND_PORT__
    : null;
}

function baseUrl(): string {
  const port = backendPort();
  if (port) {
    return `http://127.0.0.1:${port}/api/v1`;
  }
  const envPort = process.env.NEXT_PUBLIC_BACKEND_PORT?.trim();
  if (envPort) {
    return `http://127.0.0.1:${envPort}/api/v1`;
  }
  return "/api/v1";
}

export type ApiResponse<T> = {
  status: string;
  data: T;
  message: string;
  meta: { page?: number; limit?: number; total?: number; category_counts?: Record<string, number>; [k: string]: unknown };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const json = (await res.json()) as ApiResponse<T>;
  return json.data;
}

async function requestFull<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${baseUrl()}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as ApiResponse<T>;
}

// ---- Types ----

export type Project = {
  id: string;
  name: string;
  project_path: string;
  type: string | null;
  phase: string | null;
  status: string | null;
  manager: string | null;
  file_count: number;
  cad_count: number;
  material_count: number;
  last_updated_at: string | null;
  is_favorite: number;
};

export type ProjectOverview = {
  id: string;
  name: string;
  path: string;
  type: string | null;
  phase: string | null;
  status: string;
  manager: string | null;
  file_count: number;
  cad_count: number;
  material_count: number;
  created_at: string;
  last_updated_at: string | null;
  schema_version: number | null;
  summary: string | null;
  tags: string[];
};

export type AIMetadata = {
  summary: string;
  core_needs: string[];
  special_reqs: string[];
  risks: string[];
  lessons: string[];
};

export type KnowledgePayload = AIMetadata & {
  tags: string[];
  evidence: Array<Record<string, unknown>>;
};

export type KnowledgeSource = {
  id: string;
  file_id: string;
  relative_path: string;
  extractor: string;
  text_excerpt: string;
  text_length: number;
  status: "ready" | "unextracted" | "failed" | "unavailable" | "unsupported" | string;
  error_message: string | null;
  extracted_at: string;
};

export type KnowledgeDraft = {
  id: string;
  draft: KnowledgePayload;
  provider_name: string | null;
  model_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProjectKnowledge = {
  project_id: string;
  knowledge: KnowledgePayload;
  status: string;
  draft: KnowledgeDraft | null;
  sources: KnowledgeSource[];
  updated_at: string | null;
};

export type KnowledgeHistoryItem = {
  id: string;
  event_type: string;
  draft_id: string | null;
  provider_name: string | null;
  model_id: string | null;
  status: string;
  created_at: string;
};

export type KnowledgeHistory = {
  project_id: string;
  items: KnowledgeHistoryItem[];
  total: number;
  limit: number;
  offset: number;
};

export type KnowledgeExtractionResult = {
  project_id: string;
  processed: number;
  ready: number;
  failed: number;
  sources: KnowledgeSource[];
};

export type KnowledgeDraftResult = {
  draft_id: string;
  status: string;
  draft: KnowledgePayload;
  provider_name?: string | null;
  model_name?: string | null;
};

export type KnowledgeApplyResult = {
  applied: boolean;
  draft_id: string;
  project_json_backup: string;
  updated_fields: string[];
};

export type HealthDiagnostics = {
  status: string;
  service: string;
  database: { path: string; exists: boolean };
  runtime_mode: string;
  database_path: string;
  database_source: string;
  database_user_version: number | null;
};

export type KnowledgeDiscardResult = {
  draft_id: string;
  discarded: boolean;
};

export type ProjectFile = {
  id: string;
  file_name: string;
  relative_path: string;
  relative_dir: string | null;
  extension: string | null;
  size_bytes: number;
  last_modified: string | null;
};

export type ProjectResourceFile = {
  id: string | null;
  file_name: string;
  relative_path: string;
  extension: string | null;
  size_bytes: number;
  last_modified: string | null;
  indexed: boolean;
  available: boolean;
};

export type ProjectResourceFolder = {
  name: string;
  relative_path: string;
};

export type ProjectResources = {
  directory: string;
  folders: ProjectResourceFolder[];
  files: ProjectResourceFile[];
};

export type TreeNode = {
  name: string;
  file_count: number;
  children: TreeNode[];
};

export type Drawing = {
  id: string;
  file_id: string;
  project_id: string;
  file_name: string;
  relative_path: string;
  extension: string | null;
  size_bytes: number;
  dwg_category: string | null;
  version_group: string | null;
  version_number: number | null;
  is_current: number;
  last_modified: string | null;
};

export type DrawingCenterItem = {
  drawing_id: string;
  project_id: string;
  project_name: string;
  file_name: string;
  relative_path: string;
  dwg_category: string | null;
  version_group: string | null;
  version_number: number | null;
  last_modified: string | null;
  size_bytes: number;
};

export type DrawingVersionChain = {
  drawing_id: string;
  version_group: string;
  version_chain: Array<{
    id: string;
    file_name: string;
    version_number: number | null;
    last_modified: string | null;
    is_current: number;
  }>;
};

export type Material = {
  id: string;
  file_id: string;
  project_id: string;
  material_type: string | null;
  file_name: string | null;
  relative_path: string | null;
  extension: string | null;
  size_bytes: number | null;
  last_modified: string | null;
  available: boolean;
};

export type HistoryItem = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  event_type: string;
  status: string;
  message: string | null;
  created_at: string;
  duration_ms: number | null;
  scanner_version: string | null;
  affected_files: number | null;
};

export type SearchEntityType = "project" | "file" | "drawing" | "material" | "knowledge";

export type SearchResult = {
  result_id: string;
  entity_id: string;
  entity_type: SearchEntityType;
  project_id: string | null;
  project_name: string | null;
  title: string;
  relative_path: string | null;
  parent_path: string | null;
  extension: string | null;
  category: string | null;
  file_id: string | null;
  available: boolean;
  labels: SearchEntityType[];
  match_source: "title" | "path" | "project_name" | "category" | "extension" | "alias" | "content" | null;
  highlighted_content: string;
  score: number;
};

export type SearchRequest = {
  q: string;
  type?: "all" | SearchEntityType;
  project_id?: string;
  limit?: number;
  offset?: number;
};

export type SearchResponse = {
  query: string;
  items: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  elapsed_ms: number;
};

export type Settings = {
  root_path: string;
  root_path_accessible: boolean;
  scan_interval: number;
  auto_scan: boolean;
  backup_retention: number;
  theme: "system" | "dark" | "light";
  onboarding_completed: boolean;
};

export type SettingsUpdate = Omit<Settings, "root_path_accessible">;

export type ProjectCandidateCategory =
  | "existing_project"
  | "pending_project"
  | "suspected_subdirectory"
  | "confirmation_required"
  | "non_project_directory";

export type ProjectCandidateType =
  | "initialized_project"
  | "structured_project_candidate"
  | "ordinary_project_candidate"
  | "suspected_project_subdirectory"
  | "non_project_directory"
  | "confirmation_required";

export type ProjectCandidate = {
  folder_name: string;
  absolute_path: string;
  created_at: string | null;
  estimated_files: number;
  category: ProjectCandidateCategory;
  candidate_type: ProjectCandidateType;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  warnings: string[];
  selectable: boolean;
  requires_confirmation: boolean;
  will_write_project_json: boolean;
};

export type InitializeProjectsResult = {
  initialized_count: number;
  project_ids: string[];
  skipped: Array<{ path: string; reason: string }>;
};

export type ScannerResult = {
  project_id: string;
  created_count: number;
  updated_count: number;
  deleted_count: number;
  moved_count: number;
  relocated: boolean;
  duration_ms: number;
};

export type Provider = {
  id: string;
  name: string;
  base_url: string;
  default_model: string | null;
  is_enabled: boolean;
  has_key: boolean;
  auth_mode?: "api_key" | "none";
  credential_state: "ready" | "not_required" | "missing" | "migration_required" | "credential_store_unavailable";
};

export type ProviderModel = { id: string; owned_by?: string };
export type ProviderModels = { items: ProviderModel[]; total: number };
export type CreateProviderRequest = {
  name: string;
  base_url: string;
  default_model?: string;
  api_key?: string;
  auth_mode?: "api_key" | "none";
  is_enabled: boolean;
};
export type UpdateProviderRequest = Partial<{
  name: string;
  base_url: string;
  default_model: string | null;
  is_enabled: boolean;
  api_key: string;
  auth_mode: "api_key" | "none";
  clear_api_key: boolean;
}>;

export type DashboardMetrics = {
  project_total: number;
  cad_total: number;
  material_total: number;
};

export type ExplorerResult = {
  success: boolean;
  mode: "open_file" | "reveal_folder";
  file_id: string;
};

export type MaintenanceResult = {
  deleted_count: number;
  incremental_vacuum: boolean;
  normal_retention_days: number;
  problem_retention_days: number;
};

export type BackupResult = {
  name: string;
  size_bytes: number;
  retention_count: number;
};

export type RestoreResult = {
  restored: boolean;
  name: string;
};

export type DashboardSummary = {
  stats: {
    projects: number;
    indexed_files: number;
    drawings: number;
    materials: number;
  };
  recent_projects: Pick<Project, "id" | "name" | "status" | "file_count" | "cad_count" | "material_count" | "last_updated_at">[];
  workspace: {
    root_path: string;
    root_path_accessible: boolean;
    auto_scan_effective: boolean;
    scan_interval_effective: number | null;
    index_status: string;
    runtime_mode: string;
    database_source: string;
    scanner: { status: string; queue_length: number };
  };
  recent_activity: {
    status: "ready" | "unavailable";
    items: HistoryItem[];
    reason?: string;
  };
};

export type IndexAuditResult = {
  status: string;
  root_path: string;
  valid_projects: number;
  suspected_invalid_project_count: number;
  missing_index_count: number;
  missing_project_path_count: number;
  suspected_nested_project_json_count: number;
  project_ownership_anomaly_count: number;
  files_to_reindex: number;
  drawings_to_reindex: number;
  materials_to_reindex: number;
  filesystem_changes: number;
  project_json_changes: number;
  database_schema_changes: number;
};

export type IndexRebuildResult = {
  status: string;
  valid_projects: number;
  excluded_invalid_projects: number;
  excluded_nested_project_json: number;
  indexed_count: number;
  filesystem_changes: number;
  project_json_changes: number;
  database_schema_changes: number;
  backup: BackupResult;
  duration_ms: number;
};

// ---- API functions ----

export const api = {
  // Dashboard
  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  dashboardMetrics: () => request<DashboardMetrics>("/dashboard/metrics"),
  recentProjects: (limit = 10) => request<Project[]>(`/dashboard/recent-projects?limit=${limit}`),
  favoriteProjects: () => request<Project[]>("/projects/favorites"),

  // Projects
  projects: (params: {
    q?: string;
    type?: string;
    phase?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    order?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.type) sp.set("type", params.type);
    if (params.phase) sp.set("phase", params.phase);
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.sort_by) sp.set("sort_by", params.sort_by);
    if (params.order) sp.set("order", params.order);
    return requestFull<Project[]>(`/projects?${sp.toString()}`);
  },
  projectOverview: (id: string) => request<ProjectOverview>(`/projects/${id}/overview`),
  projectAIMetadata: (id: string) => request<AIMetadata>(`/projects/${id}/ai-metadata`),
  projectKnowledge: (id: string) => request<ProjectKnowledge>(`/projects/${id}/knowledge`),
  extractKnowledgeText: (id: string, fileIds: string[], limit = 20) =>
    request<KnowledgeExtractionResult>(`/projects/${id}/knowledge/extract-text`, {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds, limit }),
    }),
  createKnowledgeDraft: (id: string, sourceIds: string[], mode: "manual" | "ai" = "manual", providerId?: string, modelId?: string) =>
    request<KnowledgeDraftResult>(`/projects/${id}/knowledge/draft`, {
      method: "POST",
      body: JSON.stringify({ source_ids: sourceIds, mode, ...(providerId ? { provider_id: providerId } : {}), ...(modelId ? { model_id: modelId } : {}) }),
    }),
  knowledgeHistory: (id: string, limit = 20, offset = 0) =>
    request<KnowledgeHistory>(`/projects/${id}/knowledge/history?limit=${limit}&offset=${offset}`),
  applyKnowledgeDraft: (id: string, draftId: string, fields: string[]) =>
    request<KnowledgeApplyResult>(`/projects/${id}/knowledge/apply`, {
      method: "POST",
      body: JSON.stringify({ draft_id: draftId, fields, confirm: true }),
    }),
  discardKnowledgeDraft: (id: string, draftId: string) =>
    request<KnowledgeDiscardResult>(`/projects/${id}/knowledge/draft/${draftId}/discard`, {
      method: "POST",
    }),
  toggleFavorite: (id: string, isFavorite: boolean) =>
    request<{ id: string; is_favorite: boolean }>(`/projects/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ is_favorite: isFavorite }),
    }),
  projectCandidates: (rootPath: string) =>
    request<ProjectCandidate[]>(`/projects/candidates?root_path=${encodeURIComponent(rootPath)}`),
  initializeProjects: (paths: string[], defaultTags: string[] = [], confirmedPaths: string[] = []) =>
    request<InitializeProjectsResult>("/projects/initialize", {
      method: "POST",
      body: JSON.stringify({ paths, default_tags: defaultTags, confirmed_paths: confirmedPaths }),
    }),

  // Files
  projectFiles: (id: string, page = 1, limit = 50) =>
    requestFull<ProjectFile[]>(`/projects/${id}/files?page=${page}&limit=${limit}`),
  projectResources: (id: string, params: { directory?: string; sort_by?: "name" | "modified" | "size" | "type"; order?: "asc" | "desc" } = {}) => {
    const sp = new URLSearchParams();
    if (params.directory) sp.set("directory", params.directory);
    if (params.sort_by) sp.set("sort_by", params.sort_by);
    if (params.order) sp.set("order", params.order);
    const query = sp.toString();
    return request<ProjectResources>(`/projects/${id}/resources${query ? `?${query}` : ""}`);
  },
  projectFileTree: (id: string) => request<TreeNode>(`/projects/${id}/file-tree`),
  filesExportUrl: (id: string) => `${baseUrl()}/projects/${id}/files/export`,
  drawingsExportUrl: (id: string) => `${baseUrl()}/projects/${id}/drawings/export`,

  // Drawings
  projectDrawings: (id: string, category?: string) => request<Drawing[]>(`/projects/${id}/drawings${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  drawingsCenter: (params: { page?: number; limit?: number; sort_by?: string; category?: string; project_id?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.sort_by) sp.set("sort_by", params.sort_by);
    if (params.category) sp.set("category", params.category);
    if (params.project_id) sp.set("project_id", params.project_id);
    if (params.q) sp.set("q", params.q);
    return requestFull<DrawingCenterItem[]>(`/drawings/center?${sp.toString()}`);
  },
  drawingVersions: (id: string) => request<DrawingVersionChain>(`/drawings/${id}/versions`),

  // Materials
  projectMaterials: (id: string, materialType?: string) => request<Material[]>(`/projects/${id}/materials${materialType ? `?material_type=${encodeURIComponent(materialType)}` : ""}`),

  // History
  projectHistory: (id: string, page = 1, limit = 50) =>
    requestFull<HistoryItem[]>(`/history?project_id=${id}&page=${page}&limit=${limit}`),
  history: (page = 1, limit = 50) =>
    requestFull<HistoryItem[]>(`/history?page=${page}&limit=${limit}`),

  // Search
  search: ({ q, type = "all", project_id, limit = 20, offset = 0 }: SearchRequest, signal?: AbortSignal) => {
    const sp = new URLSearchParams({ q, type, limit: String(limit), offset: String(offset) });
    if (project_id) sp.set("project_id", project_id);
    return request<SearchResponse>(`/search?${sp.toString()}`, { signal });
  },

  // Settings
  getHealth: () => request<HealthDiagnostics>("/health"),
  getSettings: () => request<Settings>("/settings"),
  saveSettings: async (settings: SettingsUpdate) => {
    const saved = await request<Settings>("/settings", { method: "PUT", body: JSON.stringify(settings) });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pv-settings-change", { detail: saved }));
    }
    return saved;
  },

  // System
  openFile: (fileId: string) =>
    request<ExplorerResult>("/system/explorer/open", {
      method: "POST",
      body: JSON.stringify({ file_id: fileId, mode: "open_file" }),
    }),
  revealFile: (fileId: string) =>
    request<ExplorerResult>("/system/explorer/open", {
      method: "POST",
      body: JSON.stringify({ file_id: fileId, mode: "reveal_folder" }),
    }),
  runMaintenance: () =>
    request<MaintenanceResult>("/system/maintenance/run", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  createBackup: () =>
    request<BackupResult>("/system/backup/create", { method: "POST" }),
  restoreBackup: (name: string) =>
    request<RestoreResult>("/system/backup/restore", {
      method: "POST",
      body: JSON.stringify({ name, confirm: true }),
    }),
  auditIndexes: (rootPath?: string) =>
    request<IndexAuditResult>("/system/index/audit", {
      method: "POST",
      body: JSON.stringify({ root_path: rootPath || null }),
    }),
  rebuildIndexes: (rootPath: string, confirm: boolean) =>
    request<IndexRebuildResult>("/system/index/rebuild", {
      method: "POST",
      body: JSON.stringify({ root_path: rootPath, confirm }),
    }),

  // Scanner
  scanProject: (projectId: string) =>
    request<ScannerResult>(
      "/scanner/scan",
      { method: "POST", body: JSON.stringify({ project_id: projectId }) }
    ),

  // AI Providers
  providers: () => request<Provider[]>("/providers"),
  createProvider: (p: CreateProviderRequest) =>
    request<Provider>("/providers", { method: "POST", body: JSON.stringify(p) }),
  updateProvider: (id: string, p: UpdateProviderRequest) =>
    request<Provider>(`/providers/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  deleteProvider: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/providers/${id}`, { method: "DELETE" }),
  testProvider: (id: string) =>
    request<{ id: string; name: string; ready: boolean; code: string; message: string; http_status: number | null; elapsed_ms: number }>(`/providers/${id}/test`, { method: "POST" }),
  providerModels: (id: string) => request<ProviderModels>(`/providers/${id}/models`),
  previewProviderModels: (p: { base_url: string; api_key?: string }) =>
    request<ProviderModels>("/providers/models/preview", { method: "POST", body: JSON.stringify(p) }),

  // Assets
  assetContentUrl: (fileId: string) => `${baseUrl()}/assets/${fileId}/content`,
  assetThumbnailUrl: (fileId: string, size = 200) => `${baseUrl()}/assets/${fileId}/thumbnail?size=${size}`,
  assetTextUrl: (fileId: string) => `${baseUrl()}/assets/${fileId}/text`,
  fetchAssetText: async (fileId: string): Promise<string> => {
    const res = await fetch(`${baseUrl()}/assets/${fileId}/text`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    return res.text();
  },
};
