import { describe, it, expect, vi } from "vitest";
import { osc8Link, printPageReview } from "../../../lib/ui-generator/terminal-links.js";

// ─── osc8Link ────────────────────────────────────────────────────────────────

describe("osc8Link", () => {
  it("wraps URL in OSC 8 escape sequences", () => {
    const result = osc8Link("https://example.com", "Click Here");
    expect(result).toContain("https://example.com");
    expect(result).toContain("Click Here");
    // Check OSC 8 opener and closer
    expect(result).toContain("\x1b]8;;https://example.com\x1b\\");
    expect(result).toContain("\x1b]8;;\x1b\\");
  });

  it("uses URL as label when label not provided", () => {
    const result = osc8Link("https://example.com");
    // The display text should be the URL itself
    expect(result).toContain("\x1b\\https://example.com\x1b]8;;\x1b\\");
  });
});

// ─── printPageReview ─────────────────────────────────────────────────────────

describe("printPageReview", () => {
  it("prints review block with all fields", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    printPageReview({
      pageName: "Dashboard",
      pageIndex: 0,
      scoreSummary: "spec=0.85 | visual=0.80",
      approved: true,
      localUrl: "http://127.0.0.1:4200",
      screenshotUrl: "https://stitch.example.com/screenshot.png",
      htmlUrl: "https://stitch.example.com/page.html",
      figmaUrl: "https://figma.com/file/abc",
    });

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");

    expect(output).toContain("Dashboard");
    expect(output).toContain("spec=0.85");
    expect(output).toContain("Auto-approved: true");
    expect(output).toContain("Local Preview:");
    expect(output).toContain("http://127.0.0.1:4200");
    expect(output).toContain("Screenshot:");
    expect(output).toContain("screenshot.png");
    expect(output).toContain("HTML Source:");
    expect(output).toContain("Figma Export:");
    expect(output).toContain("figma.com");
    expect(output).toContain("[y]");
    expect(output).toContain("[n]");
    expect(output).toContain("[s]");

    logSpy.mockRestore();
  });

  it("omits optional fields when not provided", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    printPageReview({
      pageName: "Login",
      pageIndex: 1,
    });

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");

    expect(output).toContain("Login");
    expect(output).not.toContain("Local Preview:");
    expect(output).not.toContain("Screenshot:");
    expect(output).not.toContain("HTML Source:");
    expect(output).not.toContain("Figma Export:");

    logSpy.mockRestore();
  });

  it("omits Figma link when figmaUrl is null", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    printPageReview({
      pageName: "Settings",
      pageIndex: 2,
      figmaUrl: null,
    });

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");

    expect(output).not.toContain("Figma Export:");

    logSpy.mockRestore();
  });
});
