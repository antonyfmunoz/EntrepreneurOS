const origin = process.env.EOS_PRODUCTION_ORIGIN || "https://entrepreneuros.net";
const token = process.env.EOS_PRODUCTION_BEARER_TOKEN;
const target = new URL(origin);
if (target.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(target.hostname)) throw new Error("Final production readiness requires a public HTTPS origin.");
if (!token) throw new Error("A short-lived production platform-administrator bearer token is required.");

const response = await fetch(`${origin}/api/platform/readiness`, {
  headers: { authorization: `Bearer ${token}`, "user-agent": "EntrepreneurOS-Final-Readiness/1.0" },
  redirect: "manual",
});
if (!response.ok) throw new Error(`Production readiness probe returned ${response.status}.`);
const body = await response.json() as { ready?: boolean; standard?: string; layers?: Array<{ layer?: number; status?: string; missing?: string[] }>; configurationMissing?: string[]; missingVendors?: string[] };
const layers = body.layers || [];
if (body.standard !== "eos.production-readiness.v1" || layers.length !== 24) throw new Error("Production did not return the complete 24-layer readiness standard.");
if (!body.ready || layers.some((layer) => layer.status !== "pass" || layer.missing?.length) || body.configurationMissing?.length || body.missingVendors?.length) throw new Error("Production still has unsatisfied, expired, or mismatched readiness evidence.");
if (new Set(layers.map((layer) => layer.layer)).size !== 24) throw new Error("Production readiness contains duplicate or missing layer identities.");

console.log(JSON.stringify({ productionFinalReadiness: true, origin, standard: body.standard, layers: 24, configurationMissing: 0, missingVendors: 0 }));
