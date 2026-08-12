import { chromium } from "playwright";

const origin = process.env.EOS_E2E_CLIENT_ORIGIN || "http://127.0.0.1:5110";
const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors: string[] = [];
  desktop.on("pageerror", (error) => browserErrors.push(error.message));
  desktop.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await desktop.goto(`${origin}/portfolios`, { waitUntil: "networkidle" });
  const companyId = await desktop.evaluate(async () => {
    const portfolios = await fetch("/api/portfolios").then((response) => response.json());
    const companies = await fetch(`/api/portfolios/${portfolios[0].id}/companies`).then((response) => response.json());
    return companies[0].id as number;
  });
  await desktop.goto(`${origin}/company/${companyId}#home`, { waitUntil: "networkidle" });
  try {
    await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  } catch (error) {
    await desktop.screenshot({ path: ".tmp/e2e-failure.png", fullPage: true });
    throw new Error(`Home did not render. URL=${desktop.url()} body=${(await desktop.locator("body").innerText()).slice(0, 1200)} browserErrors=${browserErrors.join(" | ")}`, { cause: error });
  }
  await desktop.getByRole("link", { name: "Organization", exact: true }).click();
  await desktop.getByRole("heading", { name: "Organization", exact: true }).waitFor();
  const seatTitle = `Browser QA ${Date.now()}`;
  await desktop.getByPlaceholder("Seat title, e.g. Head of Growth").fill(seatTitle);
  await desktop.getByPlaceholder("Role Agent name").fill("Quinn");
  await desktop.getByRole("button", { name: "Create accountable seat" }).click();
  await desktop.getByText(seatTitle, { exact: true }).first().waitFor();
  for (const surface of ["My Role", "Work Room", "Review Room", "Academy", "Portfolio Map", "Systems"]) {
    await desktop.getByRole("link", { name: surface, exact: true }).click();
    await desktop.getByRole("heading", { name: surface, exact: true }).waitFor();
  }
  const desktopOverflow = await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (desktopOverflow) throw new Error("Desktop workspace has horizontal overflow.");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${origin}/company/${companyId}#my-role`, { waitUntil: "networkidle" });
  await mobile.getByRole("heading", { name: "My Role", exact: true }).waitFor();
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (mobileOverflow) throw new Error("Mobile workspace has horizontal overflow.");
  const fab = mobile.getByRole("button", { name: "Open communication" });
  const beforeDrag = await fab.boundingBox();
  if (!beforeDrag) throw new Error("Communication FAB did not render.");
  await mobile.mouse.move(beforeDrag.x + beforeDrag.width / 2, beforeDrag.y + beforeDrag.height / 2);
  await mobile.mouse.down();
  await mobile.mouse.move(beforeDrag.x + beforeDrag.width / 2 + 90, beforeDrag.y + beforeDrag.height / 2 - 90, { steps: 8 });
  await mobile.mouse.up();
  const afterDrag = await fab.boundingBox();
  if (!afterDrag || (Math.abs(afterDrag.x - beforeDrag.x) < 20 && Math.abs(afterDrag.y - beforeDrag.y) < 20)) throw new Error("Communication FAB did not move after a pointer drag.");
  await fab.click();
  const drawer = mobile.locator("#mobile-communication-drawer aside");
  await drawer.waitFor();
  const box = await drawer.boundingBox();
  if (!box || Math.abs(box.width - 390) > 2) throw new Error(`Mobile communication drawer is ${box?.width ?? 0}px instead of full width.`);
  await drawer.getByRole("button", { name: "Close communication" }).click();
  if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);
  console.log(JSON.stringify({ browserAcceptance: true, companyId, surfaces: 7, hierarchyBuilder: true, desktop: "1440x1000", mobile: "390x844", movableCommunicationFab: true, fullWidthCommunicationDrawer: true }));
} finally {
  await browser.close();
}
