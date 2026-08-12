import { chromium } from "playwright";

const origin = process.env.EOS_PRODUCTION_ORIGIN || "https://entrepreneuros.net";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (resource) => { if (resource.status() >= 400) errors.push(`${resource.status()} ${resource.url()}`); });
  const response = await page.goto(origin, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForFunction(() => document.body.innerText.trim().length > 20, undefined, { timeout: 30_000 });
  const body = await page.locator("body").innerText();
  if (!response?.ok()) throw new Error(`Production document returned ${response?.status() ?? "no response"}.`);
  if (body.includes("Authentication setup required")) throw new Error("Production client is missing its Clerk publishable key.");
  if (errors.length) throw new Error(`Production browser errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ productionPublicSmoke: true, origin, viewport: "390x844", renderedText: body.slice(0, 120) }));
} finally {
  await browser.close();
}
