import type { Settings } from "@/lib/api";

export const SETTINGS_CHANGE_EVENT = "pv-settings-change";

export type StartupState = "first-run" | "root-unavailable" | "ready";

export function startupState(settings: Settings): StartupState {
  if (!settings.onboarding_completed) return "first-run";
  if (!settings.root_path_accessible) return "root-unavailable";
  return "ready";
}

export function settingsErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : "";
  if (detail.includes("root_path_required")) return "请选择项目库目录";
  if (detail.includes("root_path_invalid") || detail.includes("root_path_unreadable")) return "无法访问所选目录";
  if (detail.includes("scan_interval_invalid")) return "请输入有效的扫描间隔";
  if (detail.includes("backup_retention_invalid")) return "请输入 1 至 100 之间的备份保留数量";
  return detail || "设置保存失败";
}
