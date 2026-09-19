import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
const security = readFileSync(new URL("../../server/middleware/api-security.ts", import.meta.url), "utf8");
const canonicalRuntime = readFileSync(new URL("../../server/routes/eos-runtime.ts", import.meta.url), "utf8");
const instrumentRuntime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const messageHub = readFileSync(new URL("../../client/src/components/native-message-hub.tsx", import.meta.url), "utf8");
const conferenceRooms = readFileSync(new URL("../../client/src/components/conference-room-control-center.tsx", import.meta.url), "utf8");
const nativeCrmStudio = readFileSync(new URL("../../client/src/components/native-crm-studio.tsx", import.meta.url), "utf8");
const nativeCalendarStudio = readFileSync(new URL("../../client/src/components/native-calendar-studio.tsx", import.meta.url), "utf8");
const nativeProjectsStudio = readFileSync(new URL("../../client/src/components/native-projects-studio.tsx", import.meta.url), "utf8");
const nativeDocumentsStudio = readFileSync(new URL("../../client/src/components/native-documents-studio.tsx", import.meta.url), "utf8");
const nativeSheetsStudio = readFileSync(new URL("../../client/src/components/native-sheets-studio.tsx", import.meta.url), "utf8");

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
    expect(instrumentRuntime).toContain("message_thread_scope_invalid");
    expect(instrumentRuntime).toContain("message_thread_parent_required");
    expect(instrumentRuntime).toContain("messageConversationParticipants");
    expect(messageHub).toContain("eligibleNativeConversationSeats");
    expect(messageHub).toContain("Reporting-line participants");
    expect(messageHub).toContain("role assistant to route the request");
    expect(messageHub).toContain("threadObjectId");
    expect(messageHub).toContain("Focused thread");
    expect(messageHub).toContain("visibleMessages.map");
    expect(messageHub).toContain("Showing only");
    expect(messageHub).toContain("No messages recorded in this focused thread.");
  });

  it("uses the existing governed provider run queue for Email and Slack instead of claiming delivery from the native ledger", () => {
    expect(messageHub).toContain('return "gmail.send"');
    expect(messageHub).toContain('return "slack.message.send"');
    expect(messageHub).toContain('`${root}/integration-operations/runs`');
    expect(messageHub).toContain('deliveryState: "provider_delivery_planned"');
    expect(messageHub).toContain("Planning creates no provider effect.");
    expect(messageHub).toContain("provider receipt");
  });

  it("records iMessage and Instagram work truthfully until EOS has an approved provider delivery contract", () => {
    expect(messageHub).toContain('{ key: "imessage", label: "iMessage"');
    expect(messageHub).toContain('{ key: "instagram", label: "Instagram"');
    expect(instrumentRuntime).toContain("'imessage'");
    expect(instrumentRuntime).toContain("'instagram'");
    expect(messageHub).toContain('"manual_external_intent"');
    expect(messageHub).toContain("manual external intent");
    expect(messageHub).toContain("It does not send through Apple, Meta, an SMS carrier, or any other provider.");
    expect(messageHub).toContain("No provider delivery or receipt is claimed.");
    expect(messageHub).toContain("Record observed external outcome");
    expect(messageHub).toContain('deliveryState: "manual_external_observed"');
    expect(instrumentRuntime).toContain("message_external_observation_invalid");
    expect(instrumentRuntime).toContain("message_external_observation_note_required");
    expect(instrumentRuntime).toContain("message_external_observation_reference_required");
  });

  it("links a message to only an already-authorized native CRM relationship", () => {
    expect(messageHub).toContain('`${root}/context`');
    expect(messageHub).toContain('visibleInstrumentKeys.includes("crm")');
    expect(messageHub).toContain('enabled: Boolean(canViewCrm)');
    expect(messageHub).toContain("Only relationships already visible to this role appear here.");
    expect(messageHub).toContain('relationshipType: "concerns_relationship"');
    expect(messageHub).toContain("relationshipContext");
    expect(messageHub).toContain("no email is sent until the provider's governed run is approved");
  });

  it("keeps commercial meeting context role-scoped and links it through the native operating graph", () => {
    expect(conferenceRooms).toContain('`${root}/context`');
    expect(conferenceRooms).toContain('visibleInstrumentKeys.includes("crm")');
    expect(conferenceRooms).toContain('enabled: Boolean(canViewCrm)');
    expect(conferenceRooms).toContain("Only relationships already visible to this role appear here.");
    expect(conferenceRooms).toContain('relationshipType: "concerns_relationship"');
    expect(conferenceRooms).toContain("The meeting was scheduled, but EOS could not create its CRM relationship link.");
  });

  it("projects a relationship operating context only through the server's role-scoped graph", () => {
    expect(instrumentRuntime).toContain("relationships/:relationshipObjectId/operating-context");
    expect(instrumentRuntime).toContain("crm_relationship_not_visible");
    expect(instrumentRuntime).toContain("visibleObjectSet(access, objectsForPermittedInstruments");
    expect(nativeCrmStudio).toContain("native-crm-relationship-operating-context");
    expect(nativeCrmStudio).toContain("Relationship operating context");
    expect(nativeCrmStudio).toContain("only objects already visible to your role");
  });

  it("links native calendar bookings to only role-visible CRM relationships", () => {
    expect(nativeCalendarStudio).toContain('visibleInstrumentKeys.includes("crm")');
    expect(nativeCalendarStudio).toContain('enabled: Boolean(canViewCrm)');
    expect(nativeCalendarStudio).toContain('relationshipType: "concerns_relationship"');
    expect(nativeCalendarStudio).toContain("Only CRM relationships already visible to this role appear here.");
    expect(nativeCrmStudio).toContain("bookings:");
  });

  it("links native projects to only role-visible CRM relationships", () => {
    expect(nativeProjectsStudio).toContain('visibleInstrumentKeys.includes("crm")');
    expect(nativeProjectsStudio).toContain('enabled: Boolean(canViewCrm)');
    expect(nativeProjectsStudio).toContain('relationshipType: "concerns_relationship"');
    expect(nativeProjectsStudio).toContain("Only CRM relationships already visible to this role appear here.");
    expect(nativeCrmStudio).toContain("projects:");
  });

  it("links native documents to only role-visible CRM relationships", () => {
    expect(nativeDocumentsStudio).toContain('visibleInstrumentKeys.includes("crm")');
    expect(nativeDocumentsStudio).toContain('enabled: Boolean(canViewCrm)');
    expect(nativeDocumentsStudio).toContain('relationshipType: "concerns_relationship"');
    expect(nativeDocumentsStudio).toContain("Only CRM relationships already visible to this role appear here.");
    expect(nativeCrmStudio).toContain("documents:");
  });

  it("links native workbooks to only role-visible CRM relationships", () => {
    expect(nativeSheetsStudio).toContain('visibleInstrumentKeys.includes("crm")');
    expect(nativeSheetsStudio).toContain('enabled: Boolean(canViewCrm)');
    expect(nativeSheetsStudio).toContain('relationshipType: "concerns_relationship"');
    expect(nativeSheetsStudio).toContain("Only CRM relationships already visible to this role appear here.");
    expect(nativeCrmStudio).toContain("workbooks:");
  });
});
