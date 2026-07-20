import type { HistoryItem } from "@/lib/api";
import packageJson from "@/package.json";

export const APP_VERSION = packageJson.version;

type StatusPresentation = {
  label: string;
  badgeClass: string;
  dotClass: string;
};

const eventLabels: Record<string, string> = {
  full_scan: "完整扫描",
  incremental_scan: "增量扫描",
};

export const drawingCategoryLabels: Record<string, string> = {
  GENERAL_PLAN: "总图",
  PLAN: "平面",
  CEILING: "天花图",
  FLOORING: "地坪图",
  ELEVATION: "立面",
  SECTION: "剖面图",
  DETAIL: "节点图",
  ENLARGED: "大样图",
  DOOR: "门表与门图",
  MATERIAL_SCHEDULE: "材料表",
  MEP: "机电图",
  STRUCTURE: "结构",
  CONSTRUCTION: "施工构造图",
  UNCLASSIFIED: "未分类",
};

const materialTypeLabels: Record<string, string> = {
  pdf: "PDF 文档",
  excel: "表格",
  image: "图片",
  word: "Word 文档",
};

const statusPresentations: Record<string, StatusPresentation> = {
  success: { label: "成功", badgeClass: "badge-success", dotClass: "success" },
  healthy: { label: "正常", badgeClass: "badge-success", dotClass: "success" },
  running: { label: "运行中", badgeClass: "badge-accent", dotClass: "running" },
  warning: { label: "需要注意", badgeClass: "badge-warn", dotClass: "warning" },
  failed: { label: "失败", badgeClass: "badge-danger", dotClass: "error" },
  error: { label: "失败", badgeClass: "badge-danger", dotClass: "error" },
  cancelled: { label: "已取消", badgeClass: "badge-gray", dotClass: "cancelled" },
};

const fullDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
});

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:\d{2}$)/, "$1");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDateTime(
  value: string | null | undefined,
  fallback = "时间未知",
): string {
  const date = parseDate(value);
  return date ? fullDateTimeFormatter.format(date) : fallback;
}

export function formatLocalDate(
  value: string | null | undefined,
  fallback = "时间未知",
): string {
  const date = parseDate(value);
  return date ? shortDateFormatter.format(date) : fallback;
}

export function formatRelativeTime(
  value: string | null | undefined,
  now = new Date(),
): string {
  const date = parseDate(value);
  if (!date) return "时间未知";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return formatLocalDate(value);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days === 0 && hours < 24) return `${hours}小时前`;
  if (days === 1) return "昨天";
  if (days > 1 && days <= 6) return `${days}天前`;
  return formatLocalDate(value);
}

export const getFullLocalTimeTitle = formatLocalDateTime;

export function formatEventType(eventType: string | null | undefined): string {
  return eventLabels[eventType?.toLowerCase() || ""] || "系统操作";
}

export function formatStatus(status: string | null | undefined): StatusPresentation {
  return statusPresentations[status?.toLowerCase() || ""] || {
    label: "状态未知",
    badgeClass: "badge-gray",
    dotClass: "default",
  };
}

export function formatDrawingCategory(category: string | null | undefined): string {
  return drawingCategoryLabels[category?.toUpperCase() || "UNCLASSIFIED"] || "未分类";
}

export function formatMaterialType(type: string | null | undefined): string {
  return materialTypeLabels[type?.toLowerCase() || ""] || "其他材料";
}

export function formatScanMessage(
  message: string | null | undefined,
  status?: string | null,
  eventType?: string | null,
): string {
  const normalizedStatus = status?.toLowerCase();
  const failed = normalizedStatus === "failed" || normalizedStatus === "error";
  if (failed) {
    return eventType === "full_scan" || eventType === "incremental_scan"
      ? "扫描失败"
      : "操作失败";
  }
  if (message === "full_scan_success") return "完整扫描完成";
  if (message === "incremental_scan_success") return "增量扫描完成";
  if (!message) return "操作已记录";

  const counts = new Map<string, number>();
  for (const match of message.matchAll(/\b(created|updated|deleted|moved)\s*=\s*(\d+)/gi)) {
    counts.set(match[1].toLowerCase(), Number(match[2]));
  }
  if (counts.size > 0) {
    const labels: Record<string, string> = {
      created: "新增",
      updated: "更新",
      deleted: "删除",
      moved: "移动",
    };
    const parts = ["created", "updated", "deleted", "moved"]
      .filter((key) => (counts.get(key) || 0) > 0)
      .map((key) => `${labels[key]} ${counts.get(key)} 个文件`);
    if (/\brelocated\s*=\s*true\b/i.test(message)) parts.push("项目位置已更新");
    return parts.length > 0 ? parts.join("，") : "扫描完成，未发现文件变化";
  }
  return "操作已记录";
}

export function formatProjectName(item: Pick<HistoryItem, "project_id" | "project_name">): string {
  if (!item.project_id) return "系统";
  return item.project_name || "项目已移除";
}

export function formatActivityTitle(item: HistoryItem): string {
  const event = formatEventType(item.event_type);
  if (event === "系统操作") return `${formatProjectName(item)}记录系统操作`;
  return item.project_id ? `${formatProjectName(item)}完成${event}` : `完成${event}`;
}
