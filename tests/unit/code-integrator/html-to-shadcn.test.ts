import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TranslationInput } from "../../../lib/code-integrator/types.js";

// ─── Mock Anthropic before importing the module under test ────────────────────

const mockMessagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

vi.mock("p-retry", () => ({
  default: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

// Import AFTER mocks are in place
const { translateHtmlToShadcn } = await import(
  "../../../lib/code-integrator/html-to-shadcn.js"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<TranslationInput> = {}): TranslationInput {
  return {
    htmlContent: "<div><button>Click me</button></div>",
    pageName: "TestPage",
    pageRoute: "/test",
    installedComponents: ["button", "card", "tabs"],
    authLevel: "authenticated",
    ...overrides,
  };
}

function makeResponse(content: string) {
  return {
    content: [{ type: "text", text: content }],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("translateHtmlToShadcn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts shadcn imports from TSX output", async () => {
    const tsxWithImports = `import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TestPage() {
  return (
    <Layout title="Test">
      <Card><Button>Click</Button></Card>
    </Layout>
  );
}`;

    mockMessagesCreate.mockResolvedValueOnce(makeResponse(tsxWithImports));

    const result = await translateHtmlToShadcn(makeInput());

    expect(result.extractedImports).toContain("button");
    expect(result.extractedImports).toContain("card");
    expect(result.extractedImports).toHaveLength(2);
  });

  it("detects Layout wrapper", async () => {
    const tsxWithLayout = `import { Layout } from "@/components/layout";

export default function TestPage() {
  return (
    <Layout title="Test">
      <div>content</div>
    </Layout>
  );
}`;

    mockMessagesCreate.mockResolvedValueOnce(makeResponse(tsxWithLayout));

    const result = await translateHtmlToShadcn(makeInput());

    expect(result.layoutWrapped).toBe(true);
  });

  it("strips markdown fences from output", async () => {
    const tsxWithFences = "```tsx\nexport default function Page() {\n  return <div>content</div>;\n}\n```";

    mockMessagesCreate.mockResolvedValueOnce(makeResponse(tsxWithFences));

    const result = await translateHtmlToShadcn(makeInput());

    expect(result.tsxContent).not.toContain("```");
    expect(result.tsxContent).toContain("export default function Page()");
  });

  it("rejects data-fetching code — final output must not contain useQuery", async () => {
    // First response contains forbidden data-fetching code
    const tsxWithDataFetch = `import { useQuery } from "@tanstack/react-query";
export default function TestPage() {
  const { data } = useQuery({ queryKey: ["/api/test"] });
  return <Layout title="Test"><div>{data}</div></Layout>;
}`;

    // Second response (after retry) is clean
    const cleanTsx = `export default function TestPage() {
  return <Layout title="Test"><div>static content</div></Layout>;
}`;

    mockMessagesCreate
      .mockResolvedValueOnce(makeResponse(tsxWithDataFetch))
      .mockResolvedValueOnce(makeResponse(cleanTsx));

    const result = await translateHtmlToShadcn(makeInput());

    expect(result.tsxContent).not.toMatch(/useQuery|useMutation|fetch\(|axios\./);
  });

  it("passes correct prompt structure to Claude", async () => {
    const cleanTsx = `import { Layout } from "@/components/layout";
export default function ReportsPage() {
  return <Layout title="Reports"><div>content</div></Layout>;
}`;

    mockMessagesCreate.mockResolvedValueOnce(makeResponse(cleanTsx));

    const input = makeInput({
      pageName: "Reports",
      pageRoute: "/reports",
      installedComponents: ["button", "card", "tabs"],
      htmlContent: "<div><h1>Reports</h1></div>",
    });

    await translateHtmlToShadcn(input);

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const callArg = mockMessagesCreate.mock.calls[0][0];

    // Verify model and max_tokens
    expect(callArg.model).toBe("claude-sonnet-4-5");
    expect(callArg.max_tokens).toBe(4096);

    // Verify user message contains key info
    const userMessage = callArg.messages[0].content;
    expect(userMessage).toContain("Reports");
    expect(userMessage).toContain("/reports");
    expect(userMessage).toContain("button");
    expect(userMessage).toContain("<div><h1>Reports</h1></div>");
  });
});
