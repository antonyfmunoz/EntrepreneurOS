import { describe, it, expect, vi } from "vitest";
import {
  extractScreenIdFromUrl,
  deleteScreen,
  listScreens,
} from "../../../lib/stitch/screen-management.js";

describe("extractScreenIdFromUrl", () => {
  it("extracts the screen id from a Stitch resource name", () => {
    expect(
      extractScreenIdFromUrl("projects/4044680601076201931/screens/98b50e2ddc9943efb387052637738f61")
    ).toBe("98b50e2ddc9943efb387052637738f61");
  });

  it("extracts the screen id from a screenshot URL", () => {
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
  it("returns deleted=false when no MCP invoker is provided (no real tool exists)", async () => {
    const result = await deleteScreen("p1", "scr_123");
    expect(result.deleted).toBe(false);
    expect(result.error).toContain("does not expose");
  });

  it("returns deleted=true when an injected invoker resolves", async () => {
    const invoke = vi.fn().mockResolvedValue({});
    const result = await deleteScreen("p1", "scr_123", invoke);
    expect(result.deleted).toBe(true);
    expect(invoke).toHaveBeenCalledWith("delete_screen", {
      projectId: "p1",
      screenId: "scr_123",
    });
  });

  it("catches injected invoker errors and returns deleted=false", async () => {
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
  it("returns [] for empty projectId", async () => {
    expect(await listScreens("")).toEqual([]);
  });

  it("calls the real list_screens tool name with camelCase projectId", async () => {
    const invoke = vi.fn().mockResolvedValue({ screens: [] });
    await listScreens("p1", invoke);
    expect(invoke).toHaveBeenCalledWith("list_screens", { projectId: "p1" });
  });

  it("normalises Stitch's { screens: [...] } envelope and extracts ids from resource names", async () => {
    const invoke = vi.fn().mockResolvedValue({
      screens: [
        {
          name: "projects/p1/screens/abc123",
          displayName: "Login",
          createTime: "2026-04-07T00:00:00Z",
        },
        {
          name: "projects/p1/screens/def456",
          displayName: "Dashboard",
          createTime: "2026-04-07T00:01:00Z",
        },
      ],
    });
    const result = await listScreens("p1", invoke);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "abc123",
      name: "projects/p1/screens/abc123",
      createdAt: "2026-04-07T00:00:00Z",
    });
    expect(result[1].id).toBe("def456");
  });

  it("also accepts a bare array (SDK shape drift tolerance)", async () => {
    const invoke = vi.fn().mockResolvedValue([
      { name: "projects/p1/screens/x", createTime: "2026-04-07" },
    ]);
    const result = await listScreens("p1", invoke);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("x");
  });

  it("returns [] on invoker failure (fail-open)", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("network"));
    expect(await listScreens("p1", invoke)).toEqual([]);
  });
});
