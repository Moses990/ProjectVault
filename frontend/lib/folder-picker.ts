import { open } from "@tauri-apps/plugin-dialog";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export type FolderPickResult =
  | { status: "selected"; path: string }
  | { status: "cancelled" }
  | { status: "unavailable" };

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export async function pickProjectFolder(
  openFolder?: () => Promise<string | string[] | null>,
): Promise<FolderPickResult> {
  if (!openFolder && !isDesktopApp()) return { status: "unavailable" };
  let selected: string | string[] | null;
  try {
    selected = await (openFolder ?? (async () => open({ directory: true, multiple: false, title: "选择项目库" })))();
  } catch (cause) {
    console.error("Project Vault directory picker failed", {
      operation: "plugin:dialog|open",
      window_label: "main",
      webview_origin: typeof window === "undefined" ? "unknown" : window.location.origin,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    throw cause;
  }
  if (!selected) return { status: "cancelled" };
  return { status: "selected", path: Array.isArray(selected) ? selected[0] : selected };
}
