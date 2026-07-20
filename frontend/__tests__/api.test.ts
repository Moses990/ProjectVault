import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, backendPort } from "@/lib/api";

describe("backendPort", () => {
  beforeEach(() => {
    delete (window as any).__BACKEND_PORT__;
  });

  it("returns null when __BACKEND_PORT__ is not set", () => {
    expect(backendPort()).toBeNull();
  });

  it("returns the port when __BACKEND_PORT__ is set", () => {
    (window as any).__BACKEND_PORT__ = 8420;
    expect(backendPort()).toBe(8420);
  });

  it("returns null when __BACKEND_PORT__ is 0", () => {
    (window as any).__BACKEND_PORT__ = 0;
    expect(backendPort()).toBeNull();
  });

  it("serializes the unified search contract and forwards AbortSignal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "success",
      data: { query: "平面", items: [], total: 0, limit: 12, offset: 4, has_more: false, elapsed_ms: 1.2 },
      message: "search_completed",
      meta: {},
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(api.search({ q: "平面", type: "drawing", project_id: "p1", limit: 12, offset: 4 }, controller.signal))
      .resolves.toMatchObject({ total: 0, offset: 4 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/search?q=%E5%B9%B3%E9%9D%A2&type=drawing&limit=12&offset=4&project_id=p1",
      expect.objectContaining({ signal: controller.signal }),
    );
    fetchMock.mockRestore();
  });
});
