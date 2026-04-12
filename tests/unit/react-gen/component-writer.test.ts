import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const TMP_REPO = fs.mkdtempSync(path.join(os.tmpdir(), "component-writer-test-"));

// ─── Mock Claude ─────────────────────────────────────────────────────────────

const mockStream = {
  finalMessage: vi.fn(),
};

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = {
        stream: () => mockStream,
      };
    },
  };
});

vi.mock("../../../lib/env.js", () => ({
  getAnthropicApiKey: () => "sk-test",
  getAnthropicBaseUrl: () => "https://api.anthropic.com",
}));

import { writeReactComponent, type ComponentWriterInput } from "../../../lib/react-gen/component-writer.js";

function makeInput(overrides: Partial<ComponentWriterInput> = {}): ComponentWriterInput {
  return {
    page: {
      name: "Dashboard",
      route: "/dashboard",
      purpose: "Main dashboard",
      components: ["StatsCard", "RecentActivity"],
      authLevel: "authenticated",
      priority: 1,
      dependsOn: [],
      specVersion: 1,
      source: "explicit",
      dataRequirements: [],
      apiEndpoints: [],
      validationRules: [],
      events: [],
      featureFlagCandidates: [],
    },
    pageCopy: {
      pageName: "Dashboard",
      pageHeading: "Command Center",
      pageSubheading: "Your operational overview",
      sections: [],
      ctas: [{ id: "create-task", label: "Create Task", context: "header" }],
      emptyState: "No data yet. Start by creating your first task.",
      errorMessages: { fetch: "Failed to load dashboard data" },
      placeholders: {},
      helperText: {},
      successMessages: {},
      navLabel: "Dashboard",
    },
    designSystem: "# Design System\nMinimal and clean.",
    brandVoice: "Direct, commanding, operator-focused.",
    sharedComponentPaths: { UniversalLayout: "@/components/universal-layout" },
    projectBrief: {
      productName: "TestApp",
      productDescription: "A test app",
      productVision: "",
      targetUsers: ["developers"],
      jobsToBeDone: [],
      brandVoice: "",
      designSystem: "",
      techStack: { frontend: "react", buildTool: "vite", styling: "tailwind", componentLib: "shadcn/ui", language: "typescript" },
      authProvider: "firebase",
      dbProvider: "neon",
      deployTarget: "vps",
      spec: { pages: [], sharedComponents: [], suggestedOrder: [] },
      isGreenfield: true,
      existingCodeScanned: false,
      sourceDocs: [],
    },
    projectRoot: TMP_REPO,
    ...overrides,
  };
}

const VALID_COMPONENT = `import { useQuery } from "@tanstack/react-query";

export default function DashboardPage() {
  return <div>Dashboard</div>;
}`;

beforeEach(() => {
  vi.clearAllMocks();
  // Default: generation returns valid component, review returns passing score
  mockStream.finalMessage
    .mockResolvedValueOnce({ content: [{ type: "text", text: VALID_COMPONENT }] })
    .mockResolvedValueOnce({ content: [{ type: "text", text: '{ "score": 0.9, "feedback": [] }' }] });
});

describe("writeReactComponent", () => {
  it("returns ComponentWriterOutput with correct shape", async () => {
    const result = await writeReactComponent(makeInput());

    expect(result.pageName).toBe("Dashboard");
    expect(result.filePath).toContain("dashboard-page.tsx");
    expect(result.componentCode).toContain("export default function");
    expect(typeof result.reviewScore).toBe("number");
    expect(Array.isArray(result.reviewFeedback)).toBe(true);
    expect(typeof result.passed).toBe("boolean");
    expect(typeof result.retried).toBe("boolean");
  });

  it("writes file to correct path", async () => {
    const result = await writeReactComponent(makeInput());
    const expectedPath = path.join(TMP_REPO, "client", "src", "pages", "dashboard-page.tsx");
    expect(result.filePath).toBe(expectedPath);
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it("validates against banned imports and retries", async () => {
    const BAD_COMPONENT = `import Link from "next/link";
export default function DashboardPage() { return <div />; }`;

    mockStream.finalMessage
      .mockReset()
      .mockResolvedValueOnce({ content: [{ type: "text", text: BAD_COMPONENT }] })
      // Retry generation
      .mockResolvedValueOnce({ content: [{ type: "text", text: VALID_COMPONENT }] })
      // Review
      .mockResolvedValueOnce({ content: [{ type: "text", text: '{ "score": 0.85, "feedback": [] }' }] });

    const result = await writeReactComponent(makeInput());
    expect(result.retried).toBe(true);
    // Should have called generate twice (original + retry) + review
    expect(mockStream.finalMessage).toHaveBeenCalledTimes(3);
  });

  it("validates against gradient strings and retries", async () => {
    const GRADIENT_COMPONENT = `export default function DashboardPage() {
  return <div style={{ background: "linear-gradient(to right, #000, #fff)" }} />;
}`;

    mockStream.finalMessage
      .mockReset()
      .mockResolvedValueOnce({ content: [{ type: "text", text: GRADIENT_COMPONENT }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: VALID_COMPONENT }] })
      .mockResolvedValueOnce({ content: [{ type: "text", text: '{ "score": 0.9, "feedback": [] }' }] });

    const result = await writeReactComponent(makeInput());
    expect(result.retried).toBe(true);
  });

  it("retries on low review score", async () => {
    mockStream.finalMessage
      .mockReset()
      // First generation — valid
      .mockResolvedValueOnce({ content: [{ type: "text", text: VALID_COMPONENT }] })
      // First review — low score
      .mockResolvedValueOnce({ content: [{ type: "text", text: '{ "score": 0.5, "feedback": ["Missing loading state"] }' }] })
      // Regeneration
      .mockResolvedValueOnce({ content: [{ type: "text", text: VALID_COMPONENT }] })
      // Second review
      .mockResolvedValueOnce({ content: [{ type: "text", text: '{ "score": 0.9, "feedback": [] }' }] });

    const result = await writeReactComponent(makeInput());
    expect(result.retried).toBe(true);
    expect(result.reviewScore).toBe(0.9);
  });

  it("marks as passed when score >= 0.8", async () => {
    const result = await writeReactComponent(makeInput());
    expect(result.passed).toBe(true);
    expect(result.reviewScore).toBe(0.9);
  });
});
