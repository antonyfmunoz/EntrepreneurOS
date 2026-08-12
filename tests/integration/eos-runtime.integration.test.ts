import express from "express";
import postgres from "postgres";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";

// Vitest intentionally supplies a non-routable DATABASE_URL for unit tests.
// Integration qualification opts into an explicit disposable database.
const databaseUrl = process.env.EOS_TEST_DATABASE_URL;

vi.mock("../../server/integrations/gmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server/integrations/gmail")>();
  return {
    ...actual,
    isConfigured: () => true,
    isConnected: async () => true,
    verifyConnection: async () => ({ configured: true, connected: true, healthy: true, services: { Gmail: true, Calendar: true, Drive: true }, grantedScopes: actual.requestedScopes() }),
    sendEmail: async () => ({ messageId: "gmail-provider-receipt-test" }),
  };
});

vi.mock("../../server/ai/gateway", () => ({
  callAI: async ({ context }: { context: string }) => ({ content: `Qualified response from ${context}`, model: "test-advisor-model", inputTokens: 10, outputTokens: 10, cost: 0 }),
}));

describe.skipIf(!databaseUrl)("EOS overlay HTTP lifecycle", () => {
  const ownerId = "test_eos_owner";
  const otherId = "test_eos_other";
  let companyId: number;
  let otherCompanyId: number;
  let api: ReturnType<typeof supertest>;
  let currentUserId = ownerId;
  const agentId = "test_eos_agent";
  const internalInstallationId = "test_eos_installation_row";
  const sql = postgres(databaseUrl || "postgresql://invalid", { max: 1 });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    await sql`DELETE FROM umh_installations WHERE id = ${internalInstallationId}`;
    await sql`DELETE FROM agents WHERE id = ${agentId}`;
    await sql`DELETE FROM documents WHERE user_id IN (${ownerId}, ${otherId})`;
    await sql`DELETE FROM companies WHERE owner_user_id IN (${ownerId}, ${otherId})`;
    await sql`DELETE FROM users WHERE id IN (${ownerId}, ${otherId})`;
    await sql`INSERT INTO users (id, username, password, email) VALUES (${ownerId}, 'eos_owner', 'not-used', 'owner@example.test') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO users (id, username, password, email) VALUES (${otherId}, 'eos_other', 'not-used', 'other@example.test') ON CONFLICT (id) DO NOTHING`;
    const [company] = await sql<{ id: number }[]>`INSERT INTO companies (owner_user_id, name, stage, offer, target_customer, goals) VALUES (${ownerId}, 'EOS Field Test', 'MVP', 'Governed operating system', 'Founder-led company', 'Complete the first loop') RETURNING id`;
    const [other] = await sql<{ id: number }[]>`INSERT INTO companies (owner_user_id, name) VALUES (${otherId}, 'Other Tenant') RETURNING id`;
    companyId = company.id;
    otherCompanyId = other.id;

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const owner = currentUserId === ownerId;
      (req as any).user = {
        id: currentUserId, username: owner ? "eos_owner" : "eos_other", email: owner ? "owner@example.test" : "other@example.test", password: "not-used",
        fullName: owner ? "EOS Owner" : "EOS Manager", avatar: null, company: null, role: null, clerkUserId: null,
        preferences: null, metadata: null, createdAt: new Date(), updatedAt: new Date(),
      };
      next();
    });
    const { registerRoutes } = await import("../../server/routes");
    await registerRoutes(app);
    api = supertest(app);
  }, 90_000);

  afterAll(async () => {
    await sql`DELETE FROM umh_installations WHERE id = ${internalInstallationId}`;
    await sql`DELETE FROM agents WHERE id = ${agentId}`;
    await sql`DELETE FROM documents WHERE user_id IN (${ownerId}, ${otherId})`;
    if (otherCompanyId) await sql`DELETE FROM companies WHERE id = ${otherCompanyId}`;
    if (companyId) await sql`DELETE FROM companies WHERE id = ${companyId}`;
    await sql`DELETE FROM users WHERE id IN (${ownerId}, ${otherId})`;
    await sql.end({ timeout: 5 });
    delete process.env.UMH_FEDERATION_ENABLED;
    delete process.env.UMH_INSTALLATION_ID;
    delete process.env.UMH_ISSUER;
    delete process.env.UMH_COMMAND_PUBLIC_KEY_PEM;
    delete process.env.UMH_EVENT_ENDPOINT;
    delete process.env.EOS_EVENT_PRIVATE_KEY_PEM;
  });

  it("denies cross-tenant reads and quarantines unscoped legacy APIs", async () => {
    const manifest = await api.get("/.well-known/umh/capability-manifest").expect(200);
    expect(manifest.body.enabled).toBe(false);
    await api.get(`/api/eos/companies/${otherCompanyId}/context`).expect(404);
    const legacy = await api.get("/api/tasks").expect(410);
    expect(legacy.body.code).toBe("legacy_unscoped_route_disabled");
  });

  it("compiles and activates an organization, then completes an evidence-bearing approved mission", async () => {
    const context = await api.get(`/api/eos/companies/${companyId}/context`).expect(200);
    expect(context.body.manifest).toBeNull();
    expect(context.body.principalContext.role).toBe("founder");
    expect(context.body.principalContext.visibility.scope).toBe("portfolio");

    const council = await api.get(`/api/eos/companies/${companyId}/advisor-council`).expect(200);
    expect(council.body.count).toBe(15);
    expect(council.body.advisors).toHaveLength(15);
    expect(council.body.founderFacingAgent).toBe("executive_assistant");

    const draft = await api.post(`/api/eos/companies/${companyId}/compiler/drafts`).send({
      purpose: "Prove the first governed customer-value loop",
      stage: "MVP",
      offer: "Governed operating system",
      targetCustomer: "Founder-led company",
      goals: ["Complete one repeatable loop"],
      enabledModules: Array.from({ length: 14 }, (_, index) => index + 1),
      ownerSeat: { title: "Founder / Owner", authority: "owner" },
      operatingCadence: "weekly",
      sourceAssertions: [{ label: "Owner intent", value: "Complete one repeatable loop", sourceType: "user_assertion" }],
      provisioningChecklist: [{ id: "owner", label: "Owner verified", required: true, complete: true }],
      verificationChecks: [{ id: "runtime", label: "Runtime ready", status: "passed", evidence: "/api/ready" }],
    }).expect(201);
    expect(draft.body.status).toBe("draft");
    for (const status of ["diagnostic", "proposed", "review", "approved", "provisioning", "verifying"]) {
      await api.post(`/api/eos/companies/${companyId}/manifests/${draft.body.id}/transition`).send({ status }).expect(200);
    }
    await api.post(`/api/eos/companies/${companyId}/manifests/${draft.body.id}/activate`).send({}).expect(200);

    const packet = await api.post(`/api/eos/companies/${companyId}/work-packets`).send({
      title: "Prepare customer proof",
      objective: "Create and review the first evidence-backed customer artifact",
      requiresApproval: true,
      evidenceRequirements: ["Reviewed artifact"],
    }).expect(201);
    expect(packet.body.status).toBe("awaiting_approval");
    expect(packet.body.approvalId).toBeTruthy();

    await api.post(`/api/eos/companies/${companyId}/approvals/${packet.body.approvalId}/decide`).send({ decision: "approved" }).expect(200);
    await api.post(`/api/eos/companies/${companyId}/work-packets/${packet.body.id}/transition`).send({ status: "in_progress" }).expect(200);
    await api.post(`/api/eos/companies/${companyId}/work-packets/${packet.body.id}/transition`).send({ status: "in_review" }).expect(200);
    const deniedCompletion = await api.post(`/api/eos/companies/${companyId}/work-packets/${packet.body.id}/transition`).send({ status: "completed" }).expect(409);
    expect(deniedCompletion.body.code).toBe("evidence_required");

    await api.post(`/api/eos/companies/${companyId}/evidence`).send({
      workPacketId: packet.body.id,
      evidenceType: "artifact",
      title: "Reviewed artifact",
      details: { reviewer: ownerId },
    }).expect(201);
    const completed = await api.post(`/api/eos/companies/${companyId}/work-packets/${packet.body.id}/transition`).send({ status: "completed" }).expect(200);
    expect(completed.body.status).toBe("completed");

    const audit = await api.get(`/api/eos/companies/${companyId}/audit`).expect(200);
    expect(audit.body.map((item: any) => item.action)).toEqual(expect.arrayContaining([
      "manifest.compiled", "manifest.activated", "work_packet.created", "approval.decided", "evidence.recorded", "work_packet.transitioned",
    ]));
    const systems = await api.get(`/api/eos/companies/${companyId}/integrations`).expect(200);
    expect(systems.body.find((item: any) => item.id === "umh")?.state).toBe("disabled");
  });

  it("enforces membership, reporting scope, role navigation, and assistant-mode Role Agents", async () => {
    currentUserId = ownerId;
    const managerSeat = await api.post(`/api/eos/companies/${companyId}/seats`).send({
      title: "Operations Manager", kind: "manager", agentName: "Atlas", mandate: "Own delivery operations",
      authority: { approveDownline: true }, toolEntitlements: ["gmail.send_with_local_approval"],
    }).expect(201);
    await api.post(`/api/eos/companies/${companyId}/memberships`).send({ email: "other@example.test", seatId: managerSeat.body.id, classificationCeiling: "confidential" }).expect(201);

    currentUserId = otherId;
    const context = await api.get(`/api/eos/companies/${companyId}/context`).expect(200);
    expect(context.body.principalContext.role).toBe("manager");
    expect(context.body.principalContext.communicationAgent).toBe("Atlas");
    expect(context.body.principalContext.communicationMode).toBe("role_agent_assistant");
    expect(context.body.principalContext.allowedSurfaces).toContain("my-role");
    expect(context.body.principalContext.allowedSurfaces).not.toContain("capital");
    expect(context.body.company.founderProfile).toBeUndefined();
    expect(context.body.company.ownerUserId).toBeUndefined();
    expect(context.body.manifest.manifest.founderProfile).toBeUndefined();
    await api.get(`/api/eos/companies/${companyId}/advisor-council`).expect(403);
    await api.get(`/api/eos/companies/${companyId}/advisor-council/consultations`).expect(403);
    await api.get(`/api/eos/companies/${companyId}/manifests`).expect(403);
    await api.get(`/api/eos/companies/${companyId}/audit`).expect(403);
    await api.get(`/api/eos/companies/${companyId}/integrations/notion/context`).expect(403);

    const packet = await api.post(`/api/eos/companies/${companyId}/work-packets`).send({
      title: "Manager scoped work", objective: "Prove role-scoped work visibility", requiresApproval: true,
      accountableSeatId: managerSeat.body.id, evidenceRequirements: ["Manager review"], visibility: "reporting_tree",
    }).expect(201);
    expect(packet.body.status).toBe("awaiting_approval");
    const managerApprovals = await api.get(`/api/eos/companies/${companyId}/approvals`).expect(200);
    expect(managerApprovals.body).toHaveLength(0);

    const message = await api.post(`/api/eos/companies/${companyId}/executive-assistant/messages`).send({ content: "What is my next authorized action?" }).expect(200);
    expect(message.body.assistantName).toBe("Atlas");
    const history = await api.get(`/api/eos/companies/${companyId}/executive-assistant/messages`).expect(200);
    expect(history.body.messages.length).toBeGreaterThanOrEqual(2);

    currentUserId = ownerId;
    const ownerApprovals = await api.get(`/api/eos/companies/${companyId}/approvals`).expect(200);
    expect(ownerApprovals.body.some((item: any) => item.id === packet.body.approvalId)).toBe(true);
  });

  it("executes a Gmail customer-value effect only after upward approval and records a reconciled receipt", async () => {
    currentUserId = otherId;
    const runtime = await api.get(`/api/eos/companies/${companyId}/organization-runtime`).expect(200);
    const managerSeatId = runtime.body.activeSeatId;
    const packet = await api.post(`/api/eos/companies/${companyId}/work-packets`).send({
      title: "Deliver customer update", objective: "Send the approved customer update and retain the provider receipt",
      accountableSeatId: managerSeatId, requiresApproval: false, evidenceRequirements: ["Gmail provider receipt"],
    }).expect(201);
    const execution = await api.post(`/api/eos/companies/${companyId}/work-packets/${packet.body.id}/provider-executions`).send({
      provider: "gmail", operation: "gmail.send_with_local_approval", to: "customer@example.test", subject: "Approved update", body: "Evidence-backed delivery update",
    }).expect(201);
    expect(execution.body.status).toBe("awaiting_approval");

    currentUserId = ownerId;
    const decision = await api.post(`/api/eos/companies/${companyId}/approvals/${execution.body.approvalId}/decide`).send({ decision: "approved" }).expect(200);
    expect(decision.body.providerExecution.status).toBe("succeeded");
    expect(decision.body.providerExecution.reconciliationStatus).toBe("reconciled");
    expect(decision.body.providerExecution.receipt.messageId).toBe("gmail-provider-receipt-test");
    const evidence = await api.get(`/api/eos/companies/${companyId}/evidence`).expect(200);
    expect(evidence.body.some((item: any) => item.workPacketId === packet.body.id && item.evidenceType === "provider_receipt")).toBe(true);
  });

  it("routes founder communication through persisted advisor consultations and one EA synthesis", async () => {
    currentUserId = ownerId;
    await api.post(`/api/eos/companies/${companyId}/seats`).send({
      title: "Company CEO", kind: "company_ceo", agentName: "Avery", mandate: "Own company execution and report material state upward",
    }).expect(201);
    const message = await api.post(`/api/eos/companies/${companyId}/executive-assistant/messages`).send({ content: "Assess revenue, customer risk, and governance for this offer." }).expect(200);
    expect(message.body.mode).toBe("connected_reasoning");
    const consultations = await api.get(`/api/eos/companies/${companyId}/advisor-council/consultations`).expect(200);
    expect(consultations.body).toHaveLength(4);
    expect(consultations.body.every((item: any) => item.status === "completed" && item.model === "test-advisor-model")).toBe(true);
    expect(consultations.body.map((item: any) => item.advisorId)).toEqual(expect.arrayContaining(["revenue", "customer", "governance", `company-ceo:${companyId}`]));
    const history = await api.get(`/api/eos/companies/${companyId}/executive-assistant/messages`).expect(200);
    const synthesis = history.body.messages.find((item: any) => item.id === message.body.message.id);
    expect(synthesis.provenance.consultedAdvisors).toHaveLength(4);
  });

  it("accepts a signed federated proposal once, rejects replay/scope errors, and retries outbound delivery", async () => {
    currentUserId = ownerId;
    const { privateKey: umhPrivateKey, publicKey: umhPublicKey } = generateKeyPairSync("ed25519");
    const { privateKey: eosPrivateKey } = generateKeyPairSync("ed25519");
    process.env.UMH_FEDERATION_ENABLED = "true";
    process.env.UMH_INSTALLATION_ID = "test-eos-installation";
    process.env.UMH_ISSUER = "https://umh.example.test";
    process.env.UMH_COMMAND_PUBLIC_KEY_PEM = umhPublicKey.export({ type: "spki", format: "pem" }).toString();
    process.env.UMH_EVENT_ENDPOINT = "http://127.0.0.1:9/events";
    process.env.EOS_EVENT_PRIVATE_KEY_PEM = eosPrivateKey.export({ type: "pkcs8", format: "pem" }).toString();

    await sql`INSERT INTO agents (id, company_id, name, role) VALUES (${agentId}, ${companyId}, 'Drafting Agent', 'Internal Drafter')`;
    await sql`INSERT INTO umh_installations (id, umh_installation_id, issuer, company_id, enabled, capabilities) VALUES (${internalInstallationId}, 'test-eos-installation', 'https://umh.example.test', ${companyId}, true, ${sql.json(["eos.action.propose.v1"])})`;
    await sql`INSERT INTO umh_identity_bindings (id, installation_id, external_actor_id, local_user_id, delegation_id, company_id, enabled) VALUES ('test_eos_binding', ${internalInstallationId}, 'umh_actor_owner', ${ownerId}, 'delegation_owner', ${companyId}, true)`;

    const now = Date.now();
    const command: any = {
      protocolVersion: "umh.federation.v1",
      commandId: "d61f2233-992e-4da7-a072-3d19afc5ff71",
      commandType: "eos.action.propose.v1",
      issuedAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      nonce: "nonce-1234567890abcdef",
      idempotencyKey: "idem-1234567890abcdef",
      installationId: "test-eos-installation",
      issuer: "https://umh.example.test",
      actor: { externalActorId: "umh_actor_owner", localUserId: ownerId, delegationId: "delegation_owner" },
      scope: { companyId, capabilities: ["eos.action.propose.v1"] },
      trace: { traceId: "18d6c54a-1b35-4c45-9832-9a7bd7cf1dc2", correlationId: "a1f0f94f-266b-4477-943e-d14846223c99" },
      payload: { actionType: "create_document", agentId, parameters: { title: "Federated draft", content: "Internal draft content" } },
    };
    const { canonicalCommandBytes } = await import("../../server/umh/crypto");
    const signature = sign(null, canonicalCommandBytes(command), umhPrivateKey).toString("base64url");
    const accepted = await api.post("/api/umh/v1/commands").set("x-umh-signature", signature).send(command).expect(202);
    expect(accepted.body.status).toBe("accepted");
    const actionId = accepted.body.result.actionId;
    const duplicate = await api.post("/api/umh/v1/commands").set("x-umh-signature", signature).send(command).expect(202);
    expect(duplicate.body.result.actionId).toBe(actionId);
    await api.post("/api/umh/v1/commands").set("x-umh-signature", "invalid").send(command).expect(401);

    const replay = { ...command, commandId: "18a75bf3-80e4-426f-907b-80993ce97364", idempotencyKey: "idem-replay-1234567890" };
    const replaySignature = sign(null, canonicalCommandBytes(replay), umhPrivateKey).toString("base64url");
    const replayResult = await api.post("/api/umh/v1/commands").set("x-umh-signature", replaySignature).send(replay).expect(409);
    expect(replayResult.body.code).toBe("replayed_nonce");

    const wrongScope = { ...command, commandId: "298f46f8-4e10-42ed-989d-3fb088bd57c0", nonce: "nonce-wrong-scope-123456", idempotencyKey: "idem-wrong-scope-123456", scope: { ...command.scope, companyId: otherCompanyId } };
    const wrongSignature = sign(null, canonicalCommandBytes(wrongScope), umhPrivateKey).toString("base64url");
    await api.post("/api/umh/v1/commands").set("x-umh-signature", wrongSignature).send(wrongScope).expect(403);

    const [actionCount] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM agent_actions WHERE id = ${actionId}`;
    expect(actionCount.count).toBe(1);
    const approval = await api.post(`/api/actions/${actionId}/approve`).send({}).expect(200);
    expect(approval.body.success).toBe(true);
    await api.post(`/api/actions/${actionId}/approve`).send({}).expect(409);

    const lookup = { protocolVersion: "umh.federation.v1", commandId: command.commandId, installationId: "test-eos-installation", issuer: "https://umh.example.test" };
    const lookupSignature = sign(null, canonicalCommandBytes(lookup), umhPrivateKey).toString("base64url");
    const outcome = await api.get(`/api/umh/v1/outcomes/${command.commandId}`).set("x-umh-installation-id", "test-eos-installation").set("x-umh-signature", lookupSignature).expect(200);
    expect(outcome.body.status).toBe("completed");

    const { deliverFederationOutboxOnce } = await import("../../server/umh/outbox");
    expect(await deliverFederationOutboxOnce()).toBe(0);
    const [retryState] = await sql<{ pending: number; attempted: number }[]>`SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending, count(*) FILTER (WHERE attempts > 0)::int AS attempted FROM umh_event_outbox WHERE installation_id = ${internalInstallationId}`;
    expect(retryState.pending).toBeGreaterThan(0);
    expect(retryState.attempted).toBeGreaterThan(0);
  });
});
