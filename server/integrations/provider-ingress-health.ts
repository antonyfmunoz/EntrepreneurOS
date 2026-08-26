type Registration = {
  id: string;
  integrationBindingId: string;
  provider: string;
  state: string;
  watchExpiresAt: Date | null;
  updatedAt: Date;
};

type IngressEvent = {
  id: string;
  registrationId: string;
  processingState: string;
  receivedAt: Date;
};

type ReconciliationAttempt = {
  id: string;
  registrationId: string;
  eventId: string;
  attemptNumber: number;
  outcome: string;
  failureCode: string;
  nextAttemptAt: Date | null;
  recordedAt: Date;
};

type WatchAttempt = {
  id: string;
  registrationId: string;
  attemptNumber: number;
  outcome: string;
  failureCode: string;
  nextAttemptAt: Date | null;
  recordedAt: Date;
};

export type ProviderIngressServiceObjective = {
  registrationId: string;
  watchRenewBeforeMinutes: number;
  reconciliationOverdueMinutes: number;
  pendingVerificationMinutes: number;
  externalEscalationEnabled: boolean;
  // The database constraint narrows this value. Keep the read model tolerant so
  // Drizzle's text-column inference cannot make otherwise valid policy rows
  // unusable by the health evaluator.
  minimumEscalationSeverity: string;
  maxDeliveryAttempts: number;
};

export const DEFAULT_PROVIDER_INGRESS_SERVICE_OBJECTIVE: Omit<ProviderIngressServiceObjective, "registrationId"> = {
  watchRenewBeforeMinutes: 1440,
  reconciliationOverdueMinutes: 15,
  pendingVerificationMinutes: 60,
  externalEscalationEnabled: false,
  minimumEscalationSeverity: "material",
  maxDeliveryAttempts: 5,
};

export type ProviderIngressOperationalAlert = {
  id: string;
  registrationId: string;
  integrationBindingId: string;
  severity: "warning" | "material" | "critical";
  kind: "verification_required" | "watch_start_required" | "watch_expiring" | "watch_expired" | "watch_dead_letter" | "reconciliation_overdue" | "reconciliation_dead_letter" | "registration_failed";
  action: "complete_verification" | "start_watch" | "renew_watch" | "rotate_configuration" | "replay_reconciliation";
  summary: string;
  detail: string;
  sourceEventId?: string;
  sourceAttemptId?: string;
  observedAt: string;
};

const latestBy = <T extends { attemptNumber: number }>(items: T[]) => items.reduce<T | undefined>((latest, item) => !latest || item.attemptNumber > latest.attemptNumber ? item : latest, undefined);

export function providerIngressHealthSnapshot(input: {
  registrations: Registration[];
  events: IngressEvent[];
  reconciliationAttempts: ReconciliationAttempt[];
  watchAttempts: WatchAttempt[];
  policies?: ProviderIngressServiceObjective[];
  now?: Date;
}) {
  const now = input.now || new Date();
  const alerts: ProviderIngressOperationalAlert[] = [];
  const push = (alert: ProviderIngressOperationalAlert) => alerts.push(alert);

  for (const registration of input.registrations) {
    if (registration.state === "revoked") continue;
    const policy = input.policies?.find((item) => item.registrationId === registration.id) || { registrationId: registration.id, ...DEFAULT_PROVIDER_INGRESS_SERVICE_OBJECTIVE };
    const observedAt = registration.updatedAt.toISOString();
    const watch = latestBy(input.watchAttempts.filter((item) => item.registrationId === registration.id));

    if (registration.state === "failed" || registration.state === "expired") {
      push({ id: `registration:${registration.id}:${registration.state}`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "critical", kind: "registration_failed", action: "rotate_configuration", summary: `${registration.provider} ingress is ${registration.state}.`, detail: "Rotate or repair the provider configuration, then re-establish verification before relying on inbound signals.", observedAt });
    } else if (registration.state === "pending_verification" && registration.updatedAt.getTime() + policy.pendingVerificationMinutes * 60_000 <= now.getTime()) {
      const requiresWatch = ["gmail", "google_drive", "google_calendar"].includes(registration.provider);
      const label = registration.provider === "gmail" ? "Mailbox" : registration.provider === "google_drive" ? "Google Drive" : registration.provider === "google_calendar" ? "Google Calendar" : "Notion webhook";
      push({ id: `registration:${registration.id}:pending`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "warning", kind: requiresWatch ? "watch_start_required" : "verification_required", action: requiresWatch ? "start_watch" : "complete_verification", summary: requiresWatch ? `${label} watch activation is required.` : "Notion webhook verification is required.", detail: registration.provider === "gmail" ? "Start the mailbox watch after the Pub/Sub subscription and push identity are ready." : requiresWatch ? "Start the EOS-managed Google resource channel at the exact public HTTPS callback URL." : "Complete the provider verification handshake at the exact callback URL.", observedAt });
    }

    if (["gmail", "google_drive", "google_calendar"].includes(registration.provider)) {
      const providerLabel = registration.provider === "gmail" ? "Gmail mailbox" : registration.provider === "google_drive" ? "Google Drive" : "Google Calendar";
      if (watch?.outcome === "dead_letter") {
        push({ id: `watch:${watch.id}:dead-letter`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "critical", kind: "watch_dead_letter", action: "renew_watch", summary: "Mailbox watch renewal exhausted its retry budget.", detail: `Repair ${watch.failureCode || "the provider configuration"}, then start a governed manual renewal.`, sourceAttemptId: watch.id, observedAt: watch.recordedAt.toISOString() });
      } else if (registration.state === "active" && !registration.watchExpiresAt) {
        push({ id: `watch:${registration.id}:missing`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "critical", kind: "watch_start_required", action: "start_watch", summary: `Active ${providerLabel} ingress has no watch expiry receipt.`, detail: "Start the provider watch and retain the exact provider expiry receipt.", observedAt });
      } else if (registration.state === "active" && registration.watchExpiresAt && registration.watchExpiresAt.getTime() <= now.getTime()) {
        push({ id: `watch:${registration.id}:expired`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "critical", kind: "watch_expired", action: "renew_watch", summary: `The ${providerLabel} watch has expired.`, detail: "Renew the provider watch before treating notification silence as healthy.", observedAt: registration.watchExpiresAt.toISOString() });
      } else if (registration.state === "active" && registration.watchExpiresAt && registration.watchExpiresAt.getTime() <= now.getTime() + policy.watchRenewBeforeMinutes * 60_000) {
        push({ id: `watch:${registration.id}:expiring`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "material", kind: "watch_expiring", action: "renew_watch", summary: `The ${providerLabel} watch expires within ${policy.watchRenewBeforeMinutes} minutes.`, detail: "Automatic renewal is due. A governed manual renewal remains available if the worker cannot renew it.", observedAt: registration.watchExpiresAt.toISOString() });
      }
    }
  }

  for (const event of input.events.filter((item) => item.processingState === "reconciliation_required")) {
    const registration = input.registrations.find((item) => item.id === event.registrationId);
    if (!registration || registration.state === "revoked") continue;
    const policy = input.policies?.find((item) => item.registrationId === registration.id) || { registrationId: registration.id, ...DEFAULT_PROVIDER_INGRESS_SERVICE_OBJECTIVE };
    const latest = latestBy(input.reconciliationAttempts.filter((item) => item.eventId === event.id));
    if (latest?.outcome === "succeeded") continue;
    if (latest?.outcome === "dead_letter") {
      push({ id: `reconciliation:${latest.id}:dead-letter`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "critical", kind: "reconciliation_dead_letter", action: "replay_reconciliation", summary: "A provider signal requires operator replay.", detail: `Repair ${latest.failureCode || "the provider reconciliation path"}, attach evidence, and replay this exact signal.`, sourceEventId: event.id, sourceAttemptId: latest.id, observedAt: latest.recordedAt.toISOString() });
    } else {
      const dueAt = latest?.outcome === "retry_scheduled" ? latest.nextAttemptAt : event.receivedAt;
      if (dueAt && dueAt.getTime() + policy.reconciliationOverdueMinutes * 60_000 <= now.getTime()) {
        push({ id: `reconciliation:${event.id}:overdue`, registrationId: registration.id, integrationBindingId: registration.integrationBindingId, severity: "material", kind: "reconciliation_overdue", action: "rotate_configuration", summary: "Provider reconciliation is overdue.", detail: "Check the worker, provider authorization, and bounded retry queue before retrying any external operation.", sourceEventId: event.id, sourceAttemptId: latest?.id, observedAt: dueAt.toISOString() });
      }
    }
  }

  const rank = { critical: 0, material: 1, warning: 2 } as const;
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || b.observedAt.localeCompare(a.observedAt));
  const counts = { critical: alerts.filter((item) => item.severity === "critical").length, material: alerts.filter((item) => item.severity === "material").length, warning: alerts.filter((item) => item.severity === "warning").length, open: alerts.length };
  return { generatedAt: now.toISOString(), status: counts.critical ? "critical" as const : counts.material || counts.warning ? "degraded" as const : "healthy" as const, counts, alerts };
}
