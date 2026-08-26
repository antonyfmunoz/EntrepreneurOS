import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  eosAdvisorContributions,
  eosAdvisorDeliberations,
} from "@shared/schema";
import {
  advisorDeliberationAdvance,
} from "@shared/advisor-deliberation";
import {
  buildAdvisorCouncil,
  type AdvisorCouncilManifest,
} from "@shared/eos-runtime";
import { db } from "../db";
import { callAI } from "../ai/gateway";
import { nativeContractContentSha256 } from "../esign/template-generation";

type ContributionRound = "independent" | "rebuttal" | "revision" | "synthesis";

function parseStructured(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
  try {
    const parsed = JSON.parse(candidate);
    return {
      response: typeof parsed.response === "string" ? parsed.response : content,
      claims: Array.isArray(parsed.claims) ? parsed.claims.slice(0, 50) : [],
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.slice(0, 50) : [],
      evidenceReferences: Array.isArray(parsed.evidenceReferences) ? parsed.evidenceReferences.slice(0, 100) : [],
      dissentReferences: Array.isArray(parsed.dissentReferences) ? parsed.dissentReferences.slice(0, 100) : [],
      materialDissent: Array.isArray(parsed.materialDissent) ? parsed.materialDissent.slice(0, 100) : [],
    };
  } catch {
    return { response: content, claims: [], assumptions: [], evidenceReferences: [], dissentReferences: [], materialDissent: [] };
  }
}

function contextText(deliberation: typeof eosAdvisorDeliberations.$inferSelect) {
  const packet = deliberation.contextPacket as any;
  return `Decision question: ${deliberation.question}\nDecision context: ${String(packet.decisionContext || "")}\nCompany: ${String(packet.companyName || "")}\nFounder vision: ${String(packet.founderVision || "not captured")}\nFounder values: ${String(packet.founderValues || "not captured")}\nCompany goals: ${String(packet.companyGoals || "not captured")}\nEvidence references: ${JSON.stringify(packet.evidence || [])}`;
}

function contributionValues(input: {
  deliberation: typeof eosAdvisorDeliberations.$inferSelect;
  advisor: { id: string; name: string; mandate?: string; timeHorizon?: string };
  round: ContributionRound;
  content: string;
  model?: string | null;
  status: "completed" | "failed";
  parsed?: ReturnType<typeof parseStructured>;
}) {
  const parsed = input.parsed || parseStructured(input.content);
  const projection = {
    schemaVersion: "eos.advisor-contribution.v1",
    deliberationId: input.deliberation.id,
    advisorId: input.advisor.id,
    advisorName: input.advisor.name,
    round: input.round,
    response: parsed.response,
    claims: parsed.claims,
    assumptions: parsed.assumptions,
    evidenceReferences: parsed.evidenceReferences,
    dissentReferences: parsed.dissentReferences,
    model: input.model || null,
    status: input.status,
  };
  return {
    id: randomUUID(), companyId: input.deliberation.companyId, deliberationId: input.deliberation.id,
    advisorId: input.advisor.id, advisorName: input.advisor.name, round: input.round,
    response: parsed.response, claims: parsed.claims, assumptions: parsed.assumptions,
    evidenceReferences: parsed.evidenceReferences, dissentReferences: parsed.dissentReferences,
    model: input.model || null, status: input.status,
    provenance: { schemaVersion: "eos.advisor-contribution-provenance.v1", mandate: input.advisor.mandate || "Executive Assistant synthesis", timeHorizon: input.advisor.timeHorizon || "decision horizon", contextPacketVersion: "eos.advisor-context-packet.v1", generatedByModel: input.status === "completed" },
    contentSha256: nativeContractContentSha256(projection), createdAt: new Date(),
  };
}

async function advisorCall(input: { deliberation: typeof eosAdvisorDeliberations.$inferSelect; advisor: AdvisorCouncilManifest["advisors"][number]; round: Exclude<ContributionRound, "synthesis">; prior: string }) {
  const roundInstruction = input.round === "independent"
    ? "Analyze independently. Do not assume consensus and do not imitate another advisor."
    : input.round === "rebuttal"
      ? "Cross-examine the other advisors. Identify unsupported claims, conflicts, missing evidence, and material disagreements."
      : "Revise your recommendation after the rebuttal. State what changed, what did not, and any dissent that must survive synthesis.";
  const prompt = `${contextText(input.deliberation)}\n\nPrior panel record for this round:\n${input.prior || "None; this is the independent round."}\n\n${roundInstruction}\nReturn strict JSON with response, claims (each with key, claim, confidence, evidenceRefs), assumptions, evidenceReferences, and dissentReferences. Never approve or execute an action.`;
  try {
    const output = await callAI({
      messages: [{ role: "user", content: prompt }],
      system: `You are the ${input.advisor.name} in a founder-specific portfolio council. Mandate: ${input.advisor.mandate}. Time horizon: ${input.advisor.timeHorizon}. Preserve professional boundaries, distinguish fact from inference, and attribute every material claim.`,
      tier: "standard", maxTokens: 1600, context: `eos-deliberation:${input.deliberation.id}:${input.round}:${input.advisor.id}`,
      companyId: input.deliberation.companyId, userId: input.deliberation.recordedByUserId,
    });
    return contributionValues({ deliberation: input.deliberation, advisor: input.advisor, round: input.round, content: output.content, model: output.model, status: "completed" });
  } catch (error) {
    return contributionValues({ deliberation: input.deliberation, advisor: input.advisor, round: input.round, content: `Advisor round unavailable: ${error instanceof Error ? error.message : "reasoning provider failure"}`, status: "failed" });
  }
}

export async function advanceAdvisorDeliberation(deliberationId: string) {
  const [deliberation] = await db.select().from(eosAdvisorDeliberations).where(eq(eosAdvisorDeliberations.id, deliberationId)).limit(1);
  if (!deliberation) throw new Error("advisor_deliberation_not_found");
  const nextState = advisorDeliberationAdvance(deliberation.state);
  if (!nextState) throw new Error("advisor_deliberation_not_advanceable");
  const packet = deliberation.contextPacket as any;
  const council = buildAdvisorCouncil({
    founderName: packet.founderName,
    portfolioName: packet.portfolioName,
    companyName: packet.companyName,
    founderProfile: { vision: packet.founderVision, values: packet.founderValues, decisionStyle: packet.decisionStyle },
    companyGoals: packet.companyGoals,
  });
  const advisorIds = new Set(Array.isArray(deliberation.advisorIds) ? deliberation.advisorIds.map(String) : []);
  const panel = council.advisors.filter((advisor) => advisorIds.has(advisor.id));
  const prior = await db.select().from(eosAdvisorContributions).where(eq(eosAdvisorContributions.deliberationId, deliberation.id)).orderBy(asc(eosAdvisorContributions.createdAt));
  let contributions: Array<typeof eosAdvisorContributions.$inferInsert> = [];
  let synthesis = deliberation.synthesis;
  let materialDissent = deliberation.materialDissent;
  if (deliberation.state === "revision_complete") {
    const panelRecord = prior.map((item) => `[${item.round}; ${item.advisorName}; ${item.status}] ${item.response}`).join("\n\n");
    try {
      const output = await callAI({
        messages: [{ role: "user", content: `${contextText(deliberation)}\n\nComplete attributable panel record:\n${panelRecord}\n\nSynthesize for the founder. Preserve material dissent, label facts/assumptions/inferences, compare options, identify reversible versus irreversible choices, and name the decision and evidence still needed. Return strict JSON with response, claims, assumptions, evidenceReferences, dissentReferences, and materialDissent.` }],
        system: "You are the founder's user-named Executive Assistant. You are the only founder-facing synthesizer. Do not erase minority views, claim consensus where none exists, approve work, or execute anything.",
        tier: "standard", maxTokens: 2400, context: `eos-deliberation:${deliberation.id}:synthesis`, companyId: deliberation.companyId, userId: deliberation.recordedByUserId,
      });
      const parsed = parseStructured(output.content);
      synthesis = parsed.response;
      materialDissent = parsed.materialDissent.length ? parsed.materialDissent : parsed.dissentReferences;
      contributions = [contributionValues({ deliberation, advisor: { id: "executive_assistant", name: "Executive Assistant" }, round: "synthesis", content: output.content, model: output.model, status: "completed", parsed })];
    } catch (error) {
      contributions = [contributionValues({ deliberation, advisor: { id: "executive_assistant", name: "Executive Assistant" }, round: "synthesis", content: `Synthesis unavailable: ${error instanceof Error ? error.message : "reasoning provider failure"}`, status: "failed" })];
    }
  } else {
    const round: Exclude<ContributionRound, "synthesis"> = deliberation.state === "draft" ? "independent" : deliberation.state === "independent_complete" ? "rebuttal" : "revision";
    const panelRecord = round === "independent" ? "" : prior.map((item) => `[${item.round}; ${item.advisorName}] ${item.response}`).join("\n\n");
    contributions = await Promise.all(panel.map((advisor) => advisorCall({ deliberation, advisor, round, prior: panelRecord })));
  }
  const completed = contributions.filter((item) => item.status === "completed").length;
  const finalState = completed ? nextState : "failed";
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(eosAdvisorDeliberations).where(eq(eosAdvisorDeliberations.id, deliberation.id)).limit(1);
    if (!current || current.version !== deliberation.version || current.state !== deliberation.state) return current;
    if (contributions.length) await tx.insert(eosAdvisorContributions).values(contributions);
    const [updated] = await tx.update(eosAdvisorDeliberations).set({ state: finalState, synthesis, materialDissent, version: deliberation.version + 1, updatedAt: new Date() }).where(and(eq(eosAdvisorDeliberations.id, deliberation.id), eq(eosAdvisorDeliberations.version, deliberation.version))).returning();
    return updated;
  });
}
