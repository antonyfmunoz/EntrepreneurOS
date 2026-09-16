import { createHash } from "node:crypto";

type Control = {
  key: "frontend_acceptance" | "api_contract_qualification" | "ci_qualification" | "deployment_smoke" | "accessibility_performance_release";
  evidenceScope: "repository" | "production";
  evidenceUri: string;
  notes: string;
};

function requireHttpsUrl(name: string, value: string | undefined): URL {
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a secret-free HTTPS URL without query or fragment.`);
  }
  return url;
}

const origin = requireHttpsUrl("EOS_PRODUCTION_ORIGIN", process.env.EOS_PRODUCTION_ORIGIN);
const qualificationEvidence = requireHttpsUrl("EOS_QUALIFICATION_EVIDENCE_URI", process.env.EOS_QUALIFICATION_EVIDENCE_URI);
const releaseSubject = process.env.EOS_RELEASE_SUBJECT;
const bearerToken = process.env.EOS_PRODUCTION_BEARER_TOKEN;

if (!releaseSubject || !/^git:[a-f0-9]{40}$/.test(releaseSubject)) {
  throw new Error("EOS_RELEASE_SUBJECT must be the exact immutable git release subject.");
}
if (!bearerToken || bearerToken.split(".").length !== 3) {
  throw new Error("A fresh production platform-administrator bearer token is required.");
}

const now = new Date();
const expiresAt = new Date(now.getTime() + 29 * 86_400_000);
const healthEvidence = new URL("/api/health", origin).toString();
const qualificationEvidenceUri = qualificationEvidence.toString();

const controls: Control[] = [
  {
    key: "frontend_acceptance",
    evidenceScope: "repository",
    evidenceUri: qualificationEvidenceUri,
    notes: "The exact immutable release passed browser, mobile, accessibility, and local-performance acceptance in the protected qualification run.",
  },
  {
    key: "api_contract_qualification",
    evidenceScope: "repository",
    evidenceUri: qualificationEvidenceUri,
    notes: "The exact immutable release passed the protected unit and integration qualification run.",
  },
  {
    key: "ci_qualification",
    evidenceScope: "repository",
    evidenceUri: qualificationEvidenceUri,
    notes: "The exact immutable release passed the protected production-qualification pipeline.",
  },
  {
    key: "deployment_smoke",
    evidenceScope: "production",
    evidenceUri: healthEvidence,
    notes: "The guarded Fly promotion passed both public and authenticated production smoke checks for this exact release; the authenticated check covers role context and cross-tenant denial.",
  },
  {
    key: "accessibility_performance_release",
    evidenceScope: "production",
    evidenceUri: qualificationEvidenceUri,
    notes: "The exact immutable release passed browser, mobile, accessibility, and local-performance acceptance in the protected qualification run.",
  },
];

for (const control of controls) {
  const evidenceHash = createHash("sha256")
    .update(`${control.key}|${releaseSubject}|${control.evidenceUri}|${control.notes}`)
    .digest("hex");
  const response = await fetch(new URL(`/api/platform/controls/${control.key}`, origin), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      "content-type": "application/json",
      "user-agent": "EntrepreneurOS-Release-Control-Recorder/1.0",
    },
    body: JSON.stringify({
      status: "pass",
      evidenceUri: control.evidenceUri,
      evidenceHash,
      evidenceScope: control.evidenceScope,
      subject: releaseSubject,
      notes: control.notes,
      reviewedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not record ${control.key} after release smoke (${response.status}).`);
  }
}

console.log(JSON.stringify({
  recordedReleaseQualifiedControls: true,
  releaseSubject,
  qualificationEvidenceUri,
  controls: controls.map((control) => control.key),
}));
