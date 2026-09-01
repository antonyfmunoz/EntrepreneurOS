import { CONTROL_DEFINITIONS } from "./control-definitions";

export type ReadinessActionCandidate = {
  blockerKey: string;
  blockerType: "control" | "configuration" | "vendor" | "ownership";
  layer: number;
  title: string;
  evidenceClass: string;
  nextAction: string;
};

type ReadinessSnapshot = {
  layers: Array<{ layer: number; missing: string[] }>;
  configurationMissing: string[];
};

type ConfigurationActionDefinition = {
  layer: number;
  title: string;
  nextAction: string;
};

export const CONFIGURATION_ACTION_DEFINITIONS: Record<string, ConfigurationActionDefinition> = {
  managedDatabase: { layer: 3, title: "Managed production database", nextAction: "Bind the production runtime to the managed eos_db application role and prove connectivity without exposing the URL." },
  clerkPublishableProduction: { layer: 4, title: "Clerk production publishable key", nextAction: "Create the production Clerk instance and place its pk_live credential in managed production custody." },
  clerkSecretProduction: { layer: 4, title: "Clerk production secret key", nextAction: "Place the matching production Clerk sk_live credential in managed production custody." },
  sessionSecretStrong: { layer: 8, title: "Strong runtime session secret", nextAction: "Generate and store a unique production session secret of at least 32 characters." },
  credentialEncryptionConfigured: { layer: 8, title: "Credential encryption key", nextAction: "Generate and store a 32-byte production credential-encryption key." },
  googleOAuthConfigured: { layer: 21, title: "Google public OAuth", nextAction: "Configure the production Google OAuth client and exact HTTPS callback, then authorize the required scopes." },
  notionOAuthConfigured: { layer: 21, title: "Notion public OAuth", nextAction: "Create the public Notion integration, configure its exact HTTPS callback, and authorize a production user." },
  publicOriginHttps: { layer: 5, title: "Canonical HTTPS origin", nextAction: "Bind the exact production origin to HTTPS and preserve DNS and certificate evidence." },
  operationalAlertsConfigured: { layer: 12, title: "Operational alert receiver", nextAction: "Configure the signed production alert receiver and record an attributable delivery test." },
  accountDeletionEnabled: { layer: 23, title: "Account deletion worker", nextAction: "Approve the retention policy, enable deletion, and complete a production-safe lifecycle drill." },
  legalEnforcementEnabled: { layer: 15, title: "Legal acceptance enforcement", nextAction: "Publish professionally approved terms and privacy versions before enabling enforcement." },
  commercialModeDeclared: { layer: 14, title: "Commercial operating mode", nextAction: "Explicitly declare whether EOS is internal-only or a public paid SaaS before any payment authority is accepted." },
  platformBillingSafe: { layer: 14, title: "EOS subscription billing boundary", nextAction: "Keep platform billing credentials absent in internal mode, or fully qualify pricing, legal, tax, refund, and entitlement controls before public paid SaaS activation." },
  operatingCompanyPaymentsConfigured: { layer: 14, title: "Operating-company Stripe authority", nextAction: "Bind at least one operating company to its own live restricted Stripe key and binding-specific signed webhook without combining company funds." },
  anthropicConfigured: { layer: 22, title: "Production model credential", nextAction: "Place the approved production model credential in managed custody and complete model-governance evaluation." },
  productAnalyticsConfigured: { layer: 17, title: "Production analytics project", nextAction: "Configure the production analytics project and prove consent, dashboard, and retention behavior." },
  platformAdministratorsConfigured: { layer: 20, title: "Platform administrators", nextAction: "Name the production platform administrators before recording operational evidence or ownership." },
  infrastructureVendorsDeclared: { layer: 19, title: "Infrastructure vendor declarations", nextAction: "Declare the exact database, DNS, and secret-vault providers and complete their vendor reviews." },
  immutableReleaseSubject: { layer: 5, title: "Immutable release subject", nextAction: "Deploy an exact git or image digest subject and expose it through runtime health and readiness." },
  productionEnvironmentSubject: { layer: 5, title: "Production environment subject", nextAction: "Bind the runtime to the canonical entrepreneuros-production environment subject." },
  artifactStorageConfigured: { layer: 3, title: "Persistent artifact storage", nextAction: "Provision persistent private artifact storage outside the application image." },
  nativeEsignSharedStorageConfigured: { layer: 3, title: "Shared native-signing storage", nextAction: "Provision the primary shared S3-compatible signing plane with required controls." },
  nativeEsignPrimaryCredentialsConfigured: { layer: 3, title: "Primary artifact-plane credentials", nextAction: "Grant the minimum production application role access to the primary artifact plane." },
  nativeEsignPrimaryEncryptionConfigured: { layer: 3, title: "Primary artifact-plane encryption", nextAction: "Bind the primary artifact plane to an approved KMS key or distinct 256-bit SSE-C key." },
  nativeEsignBackupStorageConfigured: { layer: 13, title: "Independent backup artifact plane", nextAction: "Provision an independent backup bucket with retention, versioning, lifecycle, and restore capability." },
  nativeEsignBackupCredentialsConfigured: { layer: 13, title: "Backup artifact-plane credentials", nextAction: "Grant a distinct minimum production role access to the backup artifact plane." },
  nativeEsignBackupEncryptionConfigured: { layer: 13, title: "Backup artifact-plane encryption", nextAction: "Bind the backup plane to an independent approved KMS key or distinct 256-bit SSE-C key." },
  malwareScannerConfigured: { layer: 8, title: "Malware scanner", nextAction: "Configure the production scanner and qualify clean, infected, timeout, and unavailable outcomes." },
  candidateTranscriptionSafe: { layer: 22, title: "Candidate transcription safety", nextAction: "Keep transcription disabled or configure the approved model and complete privacy and adversarial review." },
  recoveryProviderExecutionSafe: { layer: 21, title: "Recovery provider execution safety", nextAction: "Configure binding-scoped Stripe and DocuSign authority, signed callbacks, and compensation drills before enabling effects." },
  integrationProviderExecutionSafe: { layer: 21, title: "Integration provider execution safety", nextAction: "Configure encrypted Google and Notion execution authority and exact callbacks before enabling effects." },
};

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function slug(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

export function readinessActionCandidates(snapshot: ReadinessSnapshot): ReadinessActionCandidate[] {
  const candidates = new Map<string, ReadinessActionCandidate>();
  const add = (candidate: ReadinessActionCandidate) => candidates.set(candidate.blockerKey, candidate);

  for (const layer of snapshot.layers) {
    for (const missing of layer.missing) {
      const control = CONTROL_DEFINITIONS.get(missing);
      if (control) {
        add({
          blockerKey: `control:${missing}`,
          blockerType: "control",
          layer: layer.layer,
          title: titleCase(missing),
          evidenceClass: control.allowedScopes.join(" or "),
          nextAction: `Complete ${titleCase(missing)} and record current ${control.allowedScopes.join(" or ")} evidence against its exact ${control.subjectKind} subject.`,
        });
      } else if (missing.startsWith("approved_vendor:")) {
        const name = missing.slice("approved_vendor:".length);
        add({ blockerKey: `vendor:${slug(name)}`, blockerType: "vendor", layer: 19, title: `${name} vendor review`, evidenceClass: "professional", nextAction: `Complete the current ${name} risk, DPA, subprocessor, data-exposure, and exit-plan review.` });
      } else if (layer.layer === 20) {
        add({ blockerKey: `ownership:${slug(missing)}`, blockerType: "ownership", layer: 20, title: titleCase(missing), evidenceClass: "production", nextAction: `Close the ${titleCase(missing)} ownership gap with named accountable operators and current secret-free evidence.` });
      }
    }
  }

  for (const key of snapshot.configurationMissing) {
    const definition = CONFIGURATION_ACTION_DEFINITIONS[key];
    if (!definition) throw new Error(`Unregistered production configuration action: ${key}`);
    add({ blockerKey: `configuration:${slug(key)}`, blockerType: "configuration", evidenceClass: "configuration", ...definition });
  }

  return Array.from(candidates.values()).sort((left, right) => left.layer - right.layer || left.blockerKey.localeCompare(right.blockerKey));
}
