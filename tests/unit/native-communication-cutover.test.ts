import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../../server/middleware/api-security.ts", import.meta.url), "utf8");
const canonicalRuntime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");
const instrumentRuntime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const messageHub = readFileSync(new URL("../../client/src/components/native-message-hub.tsx", import.meta.url), "utf8");

describe("native communication authority cutover", () => {
  it("does not register legacy global agent or assistant route modules", () => {
    expect(routes).not.toContain("registerAIRoutes");
    expect(routes).not.toContain("registerAgentRoutes");
    expect(routes).not.toContain('from "./routes/ai"');
    expect(routes).not.toContain('from "./routes/agents"');
  });

  it("keeps stable tombstones for every legacy communication escape hatch", () => {
    for (const path of ["agents", "ai-assistant", "/ai/models", "/ai/provider-status", "/ai/multi-agent", "/llm/chat", "/keys/save"]) {
      expect(security).toContain(path);
    }
    expect(security).toContain("/api/eos/companies/:companyId/executive-assistant/messages");
    expect(security).toContain("sunset: true");
  });

  it("retains the role-scoped EA and Role-Agent runtime as the sole chat authority", () => {
    expect(canonicalRuntime).toContain('"/api/eos/companies/:companyId/executive-assistant/messages"');
    expect(canonicalRuntime).toContain("sole founder-facing communication channel");
    expect(canonicalRuntime).toContain("Respect the reporting chain");
  });

  it("offers the native Message Hub only to explicitly entitled roles and enforces its reporting path server-side", () => {
    expect(overlay).toContain('toolEntitlements.has("messages")');
    expect(overlay).toContain("NativeMessageHub");
    expect(instrumentRuntime).toContain("assertNativeMessageCreate");
    expect(instrumentRuntime).toContain("message_reporting_path_required");
    expect(instrumentRuntime).toContain("message_conversation_membership_required");
    expect(instrumentRuntime).toContain("message_parent_required");
    expect(instrumentRuntime).toContain("messageConversationParticipants");
    expect(messageHub).toContain("eligibleNativeConversationSeats");
    expect(messageHub).toContain("Reporting-line participants");
    expect(messageHub).toContain("role assistant to route the request");
  });

  it("uses the existing governed provider run queue for Email and Slack instead of claiming delivery from the native ledger", () => {
    expect(messageHub).toContain('return "gmail.send"');
    expect(messageHub).toContain('return "slack.message.send"');
    expect(messageHub).toContain('`${root}/integration-operations/runs`');
    expect(messageHub).toContain('deliveryState: "provider_delivery_planned"');
    expect(messageHub).toContain("Planning creates no provider effect.");
    expect(messageHub).toContain("provider receipt");
  });
});
