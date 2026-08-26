import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  eosProviderIngressAlertDeliveryAttempts,
  eosProviderIngressEvents,
  eosProviderIngressPolicies,
  eosProviderIngressReconciliationAttempts,
  eosProviderIngressRegistrations,
  eosProviderIngressWatchAttempts,
} from "@shared/schema";
import { db } from "../db";
import { nativeContractContentSha256 } from "../esign/template-generation";
import { dispatchOperationalAlert } from "../observability/alerts";
import { providerIngressHealthSnapshot, type ProviderIngressOperationalAlert, type ProviderIngressServiceObjective } from "./provider-ingress-health";

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000];
const severityRank = { warning: 0, material: 1, critical: 2 } as const;

function minimumSeverity(value: string): keyof typeof severityRank {
  return value === "warning" || value === "critical" ? value : "material";
}

export function providerIngressAlertKey(alert: ProviderIngressOperationalAlert): string {
  return nativeContractContentSha256({ schemaVersion: "eos-provider-ingress-alert.v1", alertId: alert.id, observedAt: alert.observedAt });
}

function qualifies(alert: ProviderIngressOperationalAlert, policy: ProviderIngressServiceObjective): boolean {
  return policy.externalEscalationEnabled && severityRank[alert.severity] >= severityRank[minimumSeverity(policy.minimumEscalationSeverity)];
}

export async function dispatchProviderIngressAlertOnce(input: {
  alert: ProviderIngressOperationalAlert;
  policy: ProviderIngressServiceObjective;
  companyId: number;
  recordedByUserId: string;
  now?: Date;
  trigger?: "worker" | "operator_replay";
  force?: boolean;
}) {
  const now = input.now || new Date();
  const trigger = input.trigger || "worker";
  if (!input.force && !qualifies(input.alert, input.policy)) return { processed: false, reason: "policy_suppressed" as const };
  const alertKey = providerIngressAlertKey(input.alert);
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`provider-ingress-alert:${alertKey}`}))`);
    const [latest] = await tx.select().from(eosProviderIngressAlertDeliveryAttempts).where(eq(eosProviderIngressAlertDeliveryAttempts.alertKey, alertKey)).orderBy(desc(eosProviderIngressAlertDeliveryAttempts.attemptNumber)).limit(1);
    if (!input.force && latest?.outcome === "delivered") return { processed: false, reason: "already_delivered" as const, attempt: latest };
    if (!input.force && latest?.outcome === "dead_letter") return { processed: false, reason: "dead_letter" as const, attempt: latest };
    if (!input.force && latest?.outcome === "retry_scheduled" && latest.nextAttemptAt && latest.nextAttemptAt > now) return { processed: false, reason: "retry_not_due" as const, attempt: latest };

    const attemptNumber = (latest?.attemptNumber || 0) + 1;
    const payload = {
      event: "provider_ingress_health_alert",
      deduplicationKey: alertKey,
      severity: input.alert.severity.toUpperCase(),
      companyId: input.companyId,
      registrationId: input.alert.registrationId,
      integrationBindingId: input.alert.integrationBindingId,
      alertId: input.alert.id,
      alertKind: input.alert.kind,
      action: input.alert.action,
      summary: input.alert.summary,
      detail: input.alert.detail,
      sourceEventId: input.alert.sourceEventId,
      sourceAttemptId: input.alert.sourceAttemptId,
      observedAt: input.alert.observedAt,
    };
    const payloadSha256 = nativeContractContentSha256(payload);
    let deliveryResult: "sent" | "suppressed" | "unconfigured" | "failed";
    let failureCode = "";
    try {
      deliveryResult = await dispatchOperationalAlert(payload, now.getTime());
      if (deliveryResult === "unconfigured") failureCode = "operational_alert_receiver_unconfigured";
    } catch {
      deliveryResult = "failed";
      failureCode = "operational_alert_delivery_failed";
    }
    const delivered = deliveryResult === "sent" || deliveryResult === "suppressed";
    const exhausted = attemptNumber >= input.policy.maxDeliveryAttempts;
    const outcome = delivered ? "delivered" : exhausted ? "dead_letter" : "retry_scheduled";
    const nextAttemptAt = outcome === "retry_scheduled" ? new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(attemptNumber - 1, RETRY_DELAYS_MS.length - 1)]) : null;
    const [attempt] = await tx.insert(eosProviderIngressAlertDeliveryAttempts).values({
      id: randomUUID(), companyId: input.companyId, registrationId: input.alert.registrationId, alertKey, alertId: input.alert.id, alertKind: input.alert.kind, severity: input.alert.severity, attemptNumber, trigger, outcome, deliveryResult, failureCode, payloadProjection: payload, payloadSha256, nextAttemptAt, recordedByUserId: input.recordedByUserId, recordedAt: now,
    }).returning();
    return { processed: true, outcome, attempt };
  });
}

export async function dispatchProviderIngressAlertsOnce(options: { now?: Date; limit?: number } = {}) {
  const now = options.now || new Date();
  const limit = Math.min(100, Math.max(1, options.limit || 25));
  const registrations = await db.select().from(eosProviderIngressRegistrations).where(ne(eosProviderIngressRegistrations.state, "revoked")).orderBy(asc(eosProviderIngressRegistrations.updatedAt)).limit(1000);
  if (!registrations.length) return { processed: 0, delivered: 0, deadLettered: 0 };
  const registrationIds = registrations.map((item) => item.id);
  const policies = await db.select().from(eosProviderIngressPolicies).where(and(inArray(eosProviderIngressPolicies.registrationId, registrationIds), eq(eosProviderIngressPolicies.externalEscalationEnabled, true)));
  if (!policies.length) return { processed: 0, delivered: 0, deadLettered: 0 };
  const policyIds = policies.map((item) => item.registrationId);
  const [events, reconciliationAttempts, watchAttempts] = await Promise.all([
    db.select().from(eosProviderIngressEvents).where(and(inArray(eosProviderIngressEvents.registrationId, policyIds), eq(eosProviderIngressEvents.processingState, "reconciliation_required"))).orderBy(desc(eosProviderIngressEvents.receivedAt)).limit(2000),
    db.select().from(eosProviderIngressReconciliationAttempts).where(inArray(eosProviderIngressReconciliationAttempts.registrationId, policyIds)).orderBy(desc(eosProviderIngressReconciliationAttempts.recordedAt)).limit(2000),
    db.select().from(eosProviderIngressWatchAttempts).where(inArray(eosProviderIngressWatchAttempts.registrationId, policyIds)).orderBy(desc(eosProviderIngressWatchAttempts.recordedAt)).limit(2000),
  ]);
  const scopedRegistrations = registrations.filter((item) => policyIds.includes(item.id));
  const health = providerIngressHealthSnapshot({ registrations: scopedRegistrations, events, reconciliationAttempts, watchAttempts, policies, now });
  let processed = 0; let delivered = 0; let deadLettered = 0;
  for (const alert of health.alerts) {
    if (processed >= limit) break;
    const policy = policies.find((item) => item.registrationId === alert.registrationId);
    const registration = scopedRegistrations.find((item) => item.id === alert.registrationId);
    if (!policy || !registration || !qualifies(alert, policy)) continue;
    const result = await dispatchProviderIngressAlertOnce({ alert, policy, companyId: registration.companyId, recordedByUserId: registration.authorizationUserId, now });
    if (!result.processed) continue;
    processed += 1;
    if ("outcome" in result && result.outcome === "delivered") delivered += 1;
    if ("outcome" in result && result.outcome === "dead_letter") deadLettered += 1;
  }
  return { processed, delivered, deadLettered };
}
