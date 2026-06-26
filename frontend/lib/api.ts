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
  meta: { page?: number; limit?: number; total?: number; [k: string]: unknown };
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
  last_updated_at: string | null;
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

export type ProjectFile = {
  id: string;
  file_name: string;
  relative_path: string;
  relative_dir: string | null;
  extension: string | null;
  size_bytes: number;
  last_modified: string | null;
};

export type TreeNode = {
  name: string;
  file_count: number;
  children: TreeNode[];
};

export type Drawing = {
  id: string;
  project_id: string;
  file_name: string;
  relative_path: string;
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
  project_id: string;
  material_type: string | null;
  file_name: string;
  relative_path: string;
  extension: string | null;
  size_bytes: number;
  last_modified: string | null;
};

export type HistoryItem = {
  id: string;
  project_id: string | null;
  event_type: string;
  status: string;
  message: string | null;
  created_at: string;
  duration_ms: number | null;
  scanner_version: string | null;
  affected_files: number | null;
};

export type SearchResult = {
  entity_id: string;
  entity_type: string;
  title: string;
  project_id: string | null;
  highlighted_content: string | null;
  score: number;
};

export type Settings = {
  root_path: string;
  scan_interval: number;
  auto_scan: boolean;
  backup_retention: number;
  theme: string;
};

export type Provider = {
  id: string;
  name: string;
  base_url: string;
  default_model: string;
  is_enabled: boolean;
  has_key: boolean;
};

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

// ---- API functions ----

export const api = {
  // Dashboard
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
  analyzeProject: (id: string) => request<AIMetadata & { provider: string; model: string }>(`/projects/${id}/ai-analyze`, { method: "POST" }),
  toggleFavorite: (id: string, isFavorite: boolean) =>
    request<{ id: string; is_favorite: boolean }>(`/projects/${id}/favorite`, {
      method: "POST",
      body: JSON.stringify({ is_favorite: isFavorite }),
    }),

  // Files
  projectFiles: (id: string, page = 1, limit = 50) =>
    requestFull<ProjectFile[]>(`/projects/${id}/files?page=${page}&limit=${limit}`),
  projectFileTree: (id: string) => request<TreeNode>(`/projects/${id}/file-tree`),
  filesExportUrl: (id: string) => `${baseUrl()}/projects/${id}/files/export`,
  drawingsExportUrl: (id: string) => `${baseUrl()}/projects/${id}/drawings/export`,

  // Drawings
  projectDrawings: (id: string) => request<Drawing[]>(`/projects/${id}/drawings`),
  drawingsCenter: (params: { page?: number; limit?: number; sort_by?: string; category?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.sort_by) sp.set("sort_by", params.sort_by);
    if (params.category) sp.set("category", params.category);
    if (params.q) sp.set("q", params.q);
    return requestFull<DrawingCenterItem[]>(`/drawings/center?${sp.toString()}`);
  },
  drawingVersions: (id: string) => request<DrawingVersionChain>(`/drawings/${id}/versions`),

  // Materials
  projectMaterials: (id: string) => request<Material[]>(`/projects/${id}/materials`),

  // History
  projectHistory: (id: string, page = 1, limit = 50) =>
    requestFull<HistoryItem[]>(`/history?project_id=${id}&page=${page}&limit=${limit}`),
  history: (page = 1, limit = 50) =>
    requestFull<HistoryItem[]>(`/history?page=${page}&limit=${limit}`),

  // Search
  search: (q: string, category?: string, limit = 20) => {
    const sp = new URLSearchParams({ q, limit: String(limit) });
    if (category) sp.set("category", category);
    return requestFull<SearchResult[]>(`/search?${sp.toString()}`);
  },

  // Settings
  getSettings: () => request<Settings>("/settings"),
  saveSettings: (s: Settings) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(s) }),

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

  // Scanner
  scanProject: (projectId: string) =>
    request<{ project_id: string; created_count: number; updated_count: number; deleted_count: number; moved_count: number; relocated: boolean; duration_ms: number }>(
      "/scanner/scan",
      { method: "POST", body: JSON.stringify({ project_id: projectId }) }
    ),

  // AI Providers
  providers: () => request<Provider[]>("/providers"),
  createProvider: (p: { name: string; base_url: string; default_model?: string; key_reference?: string }) =>
    request<Provider>("/providers", { method: "POST", body: JSON.stringify(p) }),
  updateProvider: (id: string, p: Partial<{ name: string; base_url: string; default_model: string; is_enabled: boolean; key_reference: string }>) =>
    request<Provider>(`/providers/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  deleteProvider: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/providers/${id}`, { method: "DELETE" }),
  testProvider: (id: string) =>
    request<{ id: string; name: string; ready: boolean; message: string }>(`/providers/${id}/test`, { method: "POST" }),

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
