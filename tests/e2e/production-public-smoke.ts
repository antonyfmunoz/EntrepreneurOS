import { chromium } from "playwright";

const origin = process.env.EOS_PRODUCTION_ORIGIN || "https://entrepreneuros.net";
const parsedOrigin = new URL(origin);
if (parsedOrigin.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(parsedOrigin.hostname)) throw new Error("Production smoke requires a public HTTPS origin.");
const browser = await chromium.launch({ headless: true });

try {
  const health = await fetch(`${origin}/api/health`);
  const readiness = await fetch(`${origin}/api/ready`);
  if (!health.ok) throw new Error(`Production health returned ${health.status}.`);
  if (!readiness.ok) throw new Error(`Production readiness returned ${readiness.status}.`);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (resource) => { if (resource.status() >= 400) errors.push(`${resource.status()} ${resource.url()}`); });
  const response = await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 20, undefined, { timeout: 30_000 });
  const body = await page.locator("body").innerText();
  if (!response?.ok()) throw new Error(`Production document returned ${response?.status() ?? "no response"}.`);
  if (body.includes("Authentication setup required")) throw new Error("Production client is missing its Clerk publishable key.");
  if (response.headers()["x-clerk-auth-reason"]?.includes("dev-")) throw new Error("Production is still using a development Clerk instance.");
  if (!response.headers()["strict-transport-security"]) throw new Error("Production document is missing HSTS.");
  if (!response.headers()["content-security-policy"]) throw new Error("Production document is missing Content Security Policy.");
  if (errors.length) throw new Error(`Production browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ productionPublicSmoke: true, origin, health: true, readiness: true, productionIdentity: true, hsts: true, contentSecurityPolicy: true, viewport: "390x844", renderedTextLength: body.length }));
} finally {
  await browser.close();
}
