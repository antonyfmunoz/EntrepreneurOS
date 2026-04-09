import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock MCP invoker ───────────────────────────────────────────────────────

const mockCallTool = vi.fn();

vi.mock("../../../lib/stitch/mcp-invoker.js", () => ({
  getStitchToolClient: () => ({ callTool: mockCallTool }),
  __resetStitchToolClientForTests: vi.fn(),
  defaultStitchMcpInvoke: vi.fn(),
}));

// ─── Import under test ────────────────────────────────────────────────────────

import { attemptFigmaExport } from "../../../lib/stitch/client.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("attemptFigmaExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns URL when figma_export tool succeeds", async () => {
    mockCallTool.mockResolvedValueOnce({ url: "https://figma.com/file/abc123" });

    const result = await attemptFigmaExport("proj-1");
    expect(result).toBe("https://figma.com/file/abc123");
    expect(mockCallTool).toHaveBeenCalledWith("figma_export", { projectId: "proj-1" });
  });

  it("returns URL from figmaUrl field", async () => {
    mockCallTool
      .mockRejectedValueOnce(new Error("tool not found"))
      .mockResolvedValueOnce({ figmaUrl: "https://figma.com/file/xyz" });

    const result = await attemptFigmaExport("proj-2");
    expect(result).toBe("https://figma.com/file/xyz");
  });

  it("returns null when both tool names fail", async () => {
    mockCallTool.mockRejectedValue(new Error("tool not found"));

    const result = await attemptFigmaExport("proj-3");
    expect(result).toBeNull();
  });

  it("returns null when tool returns empty response", async () => {
    mockCallTool.mockResolvedValue({});

    const result = await attemptFigmaExport("proj-4");
    expect(result).toBeNull();
  });

  it("never throws — returns null on any error", async () => {
    mockCallTool.mockImplementation(() => { throw new TypeError("unexpected"); });

    const result = await attemptFigmaExport("proj-5");
    expect(result).toBeNull();
  });
});
