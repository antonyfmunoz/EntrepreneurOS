const origin = process.env.EOS_PRODUCTION_ORIGIN || "https://entrepreneuros.net";
const token = process.env.EOS_PRODUCTION_BEARER_TOKEN;
const companyId = Number(process.env.EOS_PRODUCTION_COMPANY_ID);
const forbiddenCompanyId = Number(process.env.EOS_PRODUCTION_FORBIDDEN_COMPANY_ID);
const target = new URL(origin);
if (target.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(target.hostname)) throw new Error("Authenticated production smoke requires a public HTTPS origin.");
if (!token || !Number.isInteger(companyId) || companyId < 1 || !Number.isInteger(forbiddenCompanyId) || forbiddenCompanyId < 1 || forbiddenCompanyId === companyId) throw new Error("Production bearer token plus distinct allowed and forbidden company IDs are required.");

async function request(path: string) {
  return fetch(`${origin}${path}`, { headers: { authorization: `Bearer ${token}`, "user-agent": "EntrepreneurOS-Production-Qualification/1.0" }, redirect: "manual" });
}

const profile = await request("/api/users/me");
if (!profile.ok) throw new Error(`Authenticated profile probe returned ${profile.status}.`);
const companies = await request("/api/companies");
if (!companies.ok) throw new Error(`Authenticated company probe returned ${companies.status}.`);
const allowed = await request(`/api/eos/companies/${companyId}/context`);
if (!allowed.ok) throw new Error(`Allowed company context returned ${allowed.status}.`);
const allowedBody = await allowed.json() as { principalContext?: { role?: string; allowedSurfaces?: string[]; communicationAgent?: string } };
if (!allowedBody.principalContext?.role || !allowedBody.principalContext.allowedSurfaces?.length || !allowedBody.principalContext.communicationAgent) throw new Error("Allowed company context is missing role-scoped navigation or communication authority.");
const forbidden = await request(`/api/eos/companies/${forbiddenCompanyId}/context`);
if (forbidden.status !== 404) throw new Error(`Cross-tenant context returned ${forbidden.status} instead of fail-closed 404.`);
const legal = await request("/api/legal/status");
if (!legal.ok) throw new Error(`Legal status probe returned ${legal.status}.`);

console.log(JSON.stringify({
  productionAuthenticatedSmoke: true,
  origin,
  authenticatedProfile: true,
  companyList: true,
  allowedCompanyRoleContext: true,
  crossTenantDenied: true,
  legalStatus: true,
}));
