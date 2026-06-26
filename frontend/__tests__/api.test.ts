import { describe, it, expect, vi, beforeEach } from "vitest";
import { backendPort } from "@/lib/api";

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
});
