import { describe, it, expect, vi } from "vitest";
import {
  extractScreenIdFromUrl,
  deleteScreen,
  listScreens,
} from "../../../lib/stitch/screen-management.js";

describe("extractScreenIdFromUrl", () => {
  it("extracts the screen id from a Stitch URL", () => {
    expect(
      extractScreenIdFromUrl("https://stitch.withgoogle.com/p/abc/screens/scr_123/preview.png")
    ).toBe("scr_123");
  });

  it("handles query strings and fragments", () => {
    expect(
      extractScreenIdFromUrl("https://stitch.withgoogle.com/screens/abc?x=1#y")
    ).toBe("abc");
  });

  it("returns null when no screen segment is present", () => {
    expect(extractScreenIdFromUrl("https://example.com/foo/bar")).toBeNull();
    expect(extractScreenIdFromUrl("")).toBeNull();
  });
});

describe("deleteScreen", () => {
  it("returns deleted=false when no MCP invoker is provided", async () => {
    const result = await deleteScreen("p1", "scr_123");
    expect(result.deleted).toBe(false);
    expect(result.error).toContain("not yet implemented");
  });

  it("returns deleted=true when MCP call succeeds", async () => {
    const invoke = vi.fn().mockResolvedValue({});
    const result = await deleteScreen("p1", "scr_123", invoke);
    expect(result.deleted).toBe(true);
    expect(invoke).toHaveBeenCalledWith("stitch_delete_screen", {
      projectId: "p1",
      screenId: "scr_123",
    });
  });

  it("catches MCP errors and returns deleted=false", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("nope"));
    const result = await deleteScreen("p1", "scr_123", invoke);
    expect(result.deleted).toBe(false);
    expect(result.error).toBe("nope");
  });

  it("validates inputs", async () => {
    expect((await deleteScreen("", "scr")).deleted).toBe(false);
    expect((await deleteScreen("p1", "")).deleted).toBe(false);
  });
});

describe("listScreens", () => {
  it("returns [] when no invoker provided", async () => {
    expect(await listScreens("p1")).toEqual([]);
  });

  it("normalises screen records returned from MCP", async () => {
    const invoke = vi.fn().mockResolvedValue([
      { id: "a", name: "Login", createdAt: "2026-01-01" },
      { id: "b", name: "Dash", createdAt: "2026-01-02" },
    ]);
    const result = await listScreens("p1", invoke);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "a", name: "Login", createdAt: "2026-01-01" });
  });

  it("returns [] on MCP failure", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("x"));
    expect(await listScreens("p1", invoke)).toEqual([]);
  });
});
