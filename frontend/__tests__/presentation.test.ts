import { describe, expect, it } from "vitest";
import packageJson from "@/package.json";
import type { HistoryItem } from "@/lib/api";
import {
  APP_VERSION,
  formatActivityTitle,
  formatDrawingCategory,
  formatEventType,
  formatLocalDateTime,
  formatProjectName,
  formatRelativeTime,
  formatScanMessage,
  formatStatus,
} from "@/lib/presentation";

function history(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "history-1",
    project_id: "project-1",
    project_name: "示例项目",
    event_type: "incremental_scan",
    status: "success",
    message: "created=3;updated=0;deleted=0;moved=0;relocated=False",
    created_at: "2026-07-13T07:57:58.760613+00:00",
    duration_ms: 5,
    scanner_version: "1",
    affected_files: 3,
    ...overrides,
  };
}

describe("统一时间展示", () => {
  it("解析 UTC、偏移和微秒，并使用浏览器本地时区", () => {
    const utc = formatLocalDateTime("2026-07-13T07:57:58Z");
    expect(utc).toBe(formatLocalDateTime("2026-07-13T15:57:58+08:00"));
    expect(utc).toBe(formatLocalDateTime("2026-07-13T07:57:58.760613+00:00"));
    expect(utc).not.toContain("T");
  });

  it("无效时间安全降级", () => {
    expect(formatLocalDateTime("not-a-date")).toBe("时间未知");
  });

  it("生成刚刚、分钟、小时、昨天、天和日期", () => {
    const now = new Date(2026, 6, 15, 12, 0, 0);
    expect(formatRelativeTime(new Date(now.getTime() - 20_000).toISOString(), now)).toBe("刚刚");
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe("5分钟前");
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 3_600_000).toISOString(), now)).toBe("2小时前");
    expect(formatRelativeTime(new Date(2026, 6, 14, 18).toISOString(), now)).toBe("昨天");
    expect(formatRelativeTime(new Date(2026, 6, 12, 12).toISOString(), now)).toBe("3天前");
    expect(formatRelativeTime(new Date(2026, 6, 8, 12).toISOString(), now)).toContain("7月8日");
  });
});

describe("统一历史展示", () => {
  it("转换真实事件并安全处理未知事件", () => {
    expect(formatEventType("full_scan")).toBe("完整扫描");
    expect(formatEventType("incremental_scan")).toBe("增量扫描");
    expect(formatEventType("future_new_event")).toBe("系统操作");
  });

  it("转换状态并安全处理未知状态", () => {
    expect(formatStatus("success").label).toBe("成功");
    expect(formatStatus("running").label).toBe("运行中");
    expect(formatStatus("warning").label).toBe("需要注意");
    expect(formatStatus("failed").label).toBe("失败");
    expect(formatStatus("cancelled").label).toBe("已取消");
    expect(formatStatus("future").label).toBe("状态未知");
  });

  it("把扫描参数转换为只含非零项的用户说明", () => {
    expect(formatScanMessage("created=0;updated=0;deleted=0;moved=0;relocated=False")).toBe("扫描完成，未发现文件变化");
    expect(formatScanMessage("created=0;updated=4;deleted=0;moved=0")).toBe("更新 4 个文件");
    expect(formatScanMessage("created=3;updated=2;deleted=1;moved=1")).toBe("新增 3 个文件，更新 2 个文件，删除 1 个文件，移动 1 个文件");
    expect(formatScanMessage("created=0;updated=0;deleted=0;moved=0;relocated=True")).toBe("项目位置已更新");
  });

  it("转换固定、未知和失败技术消息", () => {
    expect(formatScanMessage("full_scan_success")).toBe("完整扫描完成");
    expect(formatScanMessage("incremental_scan_success")).toBe("增量扫描完成");
    expect(formatScanMessage("Traceback: database locked", "error", "full_scan")).toBe("扫描失败");
    expect(formatScanMessage("future_payload")).toBe("操作已记录");
  });

  it("解析项目名称并生成 Dashboard 活动标题", () => {
    expect(formatProjectName(history())).toBe("示例项目");
    expect(formatProjectName(history({ project_id: null, project_name: null }))).toBe("系统");
    expect(formatProjectName(history({ project_name: null }))).toBe("项目已移除");
    expect(formatActivityTitle(history())).toBe("示例项目完成增量扫描");
  });

  it("Sidebar 版本来自 package.json", () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).not.toBe("1.3");
  });
});

describe("统一 CAD 分类展示", () => {
  it("本地化内部分类并安全降级未知值", () => {
    expect(formatDrawingCategory("PLAN")).toBe("平面");
    expect(formatDrawingCategory("UNCLASSIFIED")).toBe("未分类");
    expect(formatDrawingCategory("ELEVATION")).toBe("立面");
    expect(formatDrawingCategory("STRUCTURE")).toBe("结构");
    expect(formatDrawingCategory("MATERIAL_SCHEDULE")).toBe("材料表");
    expect(formatDrawingCategory("future_category")).toBe("未分类");
  });
});
