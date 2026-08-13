const origin = process.env.EOS_PRODUCTION_ORIGIN || "https://entrepreneuros.net";
const token = process.env.EOS_PRODUCTION_BEARER_TOKEN;
const expectedReleaseSubject = process.env.EOS_EXPECTED_RELEASE_SUBJECT;
const expectedEnvironmentSubject = process.env.EOS_PRODUCTION_ENVIRONMENT_SUBJECT;
const target = new URL(origin);
if (target.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(target.hostname)) throw new Error("Final production readiness requires a public HTTPS origin.");
if (!token) throw new Error("A short-lived production platform-administrator bearer token is required.");
if (!expectedReleaseSubject || !/^(git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$/.test(expectedReleaseSubject)) throw new Error("Final production readiness requires the exact immutable EOS_EXPECTED_RELEASE_SUBJECT.");
if (!expectedEnvironmentSubject || !/^environment:[a-z0-9][a-z0-9-]{2,79}$/.test(expectedEnvironmentSubject)) throw new Error("Final production readiness requires the exact production environment subject.");

const response = await fetch(`${origin}/api/platform/readiness`, {
  headers: { authorization: `Bearer ${token}`, "user-agent": "EntrepreneurOS-Final-Readiness/1.0" },
  redirect: "manual",
});
if (!response.ok) throw new Error(`Production readiness probe returned ${response.status}.`);
const body = await response.json() as { ready?: boolean; standard?: string; releaseSubject?: string; environmentSubject?: string; layers?: Array<{ layer?: number; status?: string; missing?: string[] }>; configurationMissing?: string[]; missingVendors?: string[] };
const layers = body.layers || [];
if (body.standard !== "eos.production-readiness.v1" || layers.length !== 24) throw new Error("Production did not return the complete 24-layer readiness standard.");
if (!body.ready || layers.some((layer) => layer.status !== "pass" || layer.missing?.length) || body.configurationMissing?.length || body.missingVendors?.length) throw new Error("Production still has unsatisfied, expired, or mismatched readiness evidence.");
if (new Set(layers.map((layer) => layer.layer)).size !== 24) throw new Error("Production readiness contains duplicate or missing layer identities.");
if (body.releaseSubject !== expectedReleaseSubject || body.environmentSubject !== expectedEnvironmentSubject) throw new Error("Production readiness evidence is bound to a different release or environment subject.");

console.log(JSON.stringify({ productionFinalReadiness: true, origin, releaseSubject: expectedReleaseSubject, environmentSubject: expectedEnvironmentSubject, standard: body.standard, layers: 24, configurationMissing: 0, missingVendors: 0 }));
