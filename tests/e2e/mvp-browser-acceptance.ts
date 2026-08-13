import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const origin = process.env.EOS_E2E_CLIENT_ORIGIN || "http://127.0.0.1:5110";
const browser = await chromium.launch({ headless: true });
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const desktop = await desktopContext.newPage();
  const browserErrors: string[] = [];
  desktop.on("pageerror", (error) => browserErrors.push(error.message));
  desktop.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  desktop.on("response", (response) => { if (response.status() >= 400) browserErrors.push(`${response.status()} ${response.url()}`); });
  await desktop.goto(`${origin}/portfolios`, { waitUntil: "domcontentloaded" });
  const fixture = await desktop.evaluate(async () => {
    const portfolios = await fetch("/api/portfolios").then((response) => response.json());
    const companies = await fetch(`/api/portfolios/${portfolios[0].id}/companies`).then((response) => response.json());
    return { companyId: companies[0].id as number, portfolioId: portfolios[0].id as number, portfolioName: portfolios[0].name as string };
  });
  const { companyId, portfolioId, portfolioName } = fixture;
  await desktop.goto(`${origin}/company/${companyId}#home`, { waitUntil: "domcontentloaded" });
  try {
    await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  } catch (error) {
    await desktop.screenshot({ path: ".tmp/e2e-failure.png", fullPage: true });
    throw new Error(`Home did not render. URL=${desktop.url()} body=${(await desktop.locator("body").innerText()).slice(0, 1200)} browserErrors=${browserErrors.join(" | ")}`, { cause: error });
  }
  const decisionHud = desktop.getByLabel("Executive decision control HUD");
  await decisionHud.getByRole("button", { name: /Next: Advance the organization manifest/ }).click();
  await decisionHud.getByRole("button", { name: "Continue organization setup", exact: true }).click();
  await desktop.getByRole("heading", { name: "Organization", exact: true }).waitFor();
  await desktop.getByRole("link", { name: "Home", exact: true }).click();
  await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  const primaryNavigation = desktop.getByRole("navigation", { name: "EOS primary navigation" });
  if (await primaryNavigation.getByRole("link", { name: "Portfolio", exact: true }).count()) throw new Error("Portfolio switching is still present in the EOS operating navigation.");
  if (await primaryNavigation.getByRole("link", { name: "Organizations", exact: true }).count()) throw new Error("Organization switching is still present in the EOS operating navigation.");
  await desktop.getByRole("button", { name: "Account menu" }).click();
  const accountPanel = desktop.getByRole("region", { name: "account panel" });
  await accountPanel.getByRole("link", { name: "Portfolios", exact: true }).waitFor();
  await accountPanel.getByRole("link", { name: "Organizations", exact: true }).waitFor();
  await accountPanel.getByRole("link", { name: "Settings", exact: true }).waitFor();
  await accountPanel.getByRole("link", { name: "Support", exact: true }).waitFor();
  await accountPanel.getByRole("button", { name: "Close account panel" }).click();
  await desktop.getByRole("button", { name: "Create mission" }).click();
  await desktop.getByRole("heading", { name: "Operations", exact: true }).waitFor();
  const missionTitle = `Interactive MVP ${Date.now()}`;
  await desktop.getByPlaceholder("Mission title").fill(missionTitle);
  await desktop.getByPlaceholder("Objective and intended outcome").fill("Verify the interactive decision, work, approval, and audit loop.");
  await desktop.getByRole("button", { name: "Create Work Packet" }).click();
  await desktop.getByText(missionTitle, { exact: true }).waitFor();
  await desktop.getByRole("link", { name: "Command", exact: true }).click();
  await desktop.getByRole("heading", { name: "Command", exact: true }).waitFor();
  await desktop.getByRole("button", { name: /Pending approvals: 1\. Review decisions/ }).click();
  await desktop.getByRole("heading", { name: "Review Room", exact: true }).waitFor();
  const approvalCard = desktop.getByText(`Authorize work packet: ${missionTitle}`, { exact: true }).locator("xpath=ancestor::*[.//button[normalize-space()='Approve']][1]");
  await approvalCard.waitFor();
  await approvalCard.getByRole("button", { name: "Approve", exact: true }).click();
  const approvalDialog = desktop.getByRole("alertdialog");
  await approvalDialog.getByRole("heading", { name: "Confirm approval", exact: true }).waitFor();
  await approvalDialog.getByLabel("Decision note (optional)").fill("Approved in browser acceptance after reviewing the objective and authority boundary.");
  await approvalDialog.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await desktop.getByText("Work approved", { exact: true }).waitFor();
  await desktop.getByRole("link", { name: "Operations", exact: true }).click();
  const missionCard = desktop.getByText(missionTitle, { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await missionCard.getByRole("button", { name: "Start / resume", exact: true }).click();
  await missionCard.getByRole("button", { name: "Submit for review", exact: true }).click();
  await missionCard.getByLabel(`Evidence details for ${missionTitle}`).fill("Browser acceptance verified the governed work result.");
  await missionCard.getByRole("button", { name: "Record required evidence", exact: true }).click();
  await desktop.getByText("Required evidence recorded", { exact: true }).waitFor();
  await missionCard.getByText("All required evidence is recorded. This Work Packet can complete after review.", { exact: true }).waitFor();
  await missionCard.getByRole("button", { name: "Complete", exact: true }).click();
  await missionCard.getByText("completed", { exact: true }).waitFor();
  const rejectedMissionTitle = `Rejected MVP ${Date.now()}`;
  await desktop.getByPlaceholder("Mission title").fill(rejectedMissionTitle);
  await desktop.getByPlaceholder("Objective and intended outcome").fill("Verify that rejection requires an auditable reason and an explicit confirmation.");
  await desktop.getByRole("button", { name: "Create Work Packet", exact: true }).click();
  const rejectionCard = desktop.getByText(`Authorize work packet: ${rejectedMissionTitle}`, { exact: true }).locator("xpath=ancestor::*[.//button[normalize-space()='Reject']][1]");
  await rejectionCard.getByRole("button", { name: "Reject", exact: true }).click();
  const rejectionDialog = desktop.getByRole("alertdialog");
  const confirmRejection = rejectionDialog.getByRole("button", { name: "Confirm rejection", exact: true });
  if (await confirmRejection.isEnabled()) throw new Error("Rejection confirmation was enabled without an auditable reason.");
  await rejectionDialog.getByLabel("Rejection reason").fill("The objective needs a measurable customer outcome before work begins.");
  await confirmRejection.click();
  await desktop.getByText("Work rejected", { exact: true }).waitFor();
  await desktop.getByRole("link", { name: "Organization", exact: true }).click();
  await desktop.getByRole("heading", { name: "Organization", exact: true }).waitFor();
  const seatTitle = `Browser QA ${Date.now()}`;
  await desktop.getByPlaceholder("Seat title, e.g. Head of Growth").fill(seatTitle);
  await desktop.getByPlaceholder("Role Agent name").fill("Quinn");
  await desktop.getByRole("button", { name: "Create accountable seat" }).click();
  await desktop.getByText(seatTitle, { exact: true }).first().waitFor();
  const modulesLink = desktop.getByRole("link", { name: "Modules", exact: true });
  if (!await modulesLink.count()) {
    const debugContext = await desktop.evaluate(async (id) => fetch(`/api/eos/companies/${id}/context`).then((response) => response.json()), companyId);
    throw new Error(`Modules navigation is unavailable. allowedSurfaces=${JSON.stringify(debugContext?.principalContext?.allowedSurfaces)} navigation=${JSON.stringify(await primaryNavigation.innerText())}`);
  }
  await modulesLink.click();
  await desktop.getByRole("heading", { name: "Modules", exact: true }).waitFor();
  const moduleLaunchers = desktop.getByRole("button", { name: "Open module", exact: true });
  if (await moduleLaunchers.count() !== 14) throw new Error("The founder module control center did not expose all fourteen active overlay modules.");
  const technologyModule = desktop.getByText("Technology, Integrations & Automation Control", { exact: true }).locator("xpath=ancestor::*[.//button[normalize-space()='Open module']][1]");
  await technologyModule.getByRole("button", { name: "Open module", exact: true }).click();
  await desktop.getByRole("heading", { name: "Technology, Integrations & Automation Control", exact: true }).first().waitFor();
  if (process.env.EOS_CAPTURE_VISUALS === "true") await desktop.screenshot({ path: ".tmp/eos-modules-desktop.png", fullPage: true });
  await desktop.getByRole("button", { name: "Prepare governed mission", exact: true }).click();
  await desktop.getByRole("heading", { name: "Operations", exact: true }).waitFor();
  if (await desktop.getByPlaceholder("Mission title").inputValue() !== "Module 12: Qualify an integration or automation") throw new Error("Module 12 did not prepare its governed Work Packet.");
  if (!await desktop.getByPlaceholder("Objective and intended outcome").inputValue()) throw new Error("The module Work Packet objective was not prepared.");
  await desktop.getByText("Health check, authority proof, and recovery result", { exact: true }).waitFor();
  await desktop.getByRole("link", { name: "My Role", exact: true }).click();
  await desktop.getByRole("heading", { name: "My Role", exact: true }).waitFor();
  const roleActions = desktop.getByRole("heading", { name: "My next move", exact: true }).locator("xpath=ancestor::*[.//button[normalize-space()='Open assigned work']][1]");
  await roleActions.getByRole("button", { name: "Practice this role", exact: true }).waitFor();
  await roleActions.getByRole("button", { name: "Ask Assistant", exact: true }).waitFor();
  await roleActions.getByRole("button", { name: "Open assigned work", exact: true }).click();
  await desktop.getByRole("heading", { name: "Work Room", exact: true }).waitFor();
  for (const surface of ["Review Room", "Academy", "Portfolio Map", "Systems"]) {
    await desktop.getByRole("link", { name: surface, exact: true }).click();
    await desktop.getByRole("heading", { name: surface, exact: true }).waitFor();
  }
  await desktop.getByLabel("Monthly limit (USD)").fill("30");
  await desktop.getByLabel("Per-request limit (USD)").fill("2");
  await desktop.getByRole("button", { name: "Save spend controls" }).click();
  await desktop.getByText("Spent this month:", { exact: false }).waitFor();
  await desktop.getByRole("link", { name: "Review Room", exact: true }).click();
  await desktop.getByRole("heading", { name: "Recent control receipts" }).waitFor();
  await desktop.getByText("ai budget.updated", { exact: true }).first().waitFor();
  const legacySurfaceRedirects = [
    { path: "org", hash: "organization", heading: "Organization" },
    { path: "chat", hash: "intelligence", heading: "Intelligence" },
    { path: "workflows/new", hash: "operations", heading: "Operations" },
    { path: "tasks/new", hash: "work-room", heading: "Work Room" },
  ];
  for (const legacy of legacySurfaceRedirects) {
    await desktop.goto(`${origin}/company/${companyId}/${legacy.path}`, { waitUntil: "domcontentloaded" });
    await desktop.getByRole("heading", { name: legacy.heading, exact: true }).waitFor();
    if (new URL(desktop.url()).hash !== `#${legacy.hash}`) throw new Error(`Legacy ${legacy.path} did not converge on the ${legacy.hash} EOS surface.`);
  }
  const desktopOverflow = await desktop.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (desktopOverflow) throw new Error("Desktop workspace has horizontal overflow.");
  // Radix Toast injects two aria-hidden focus guards with tabindex=0 to keep
  // keyboard focus inside transient announcements. Axe flags that deliberate
  // focus-management mechanism even though the guards have no user content.
  // All remaining WCAG A/AA rules remain release-blocking.
  const accessibility = await new AxeBuilder({ page: desktop }).disableRules(["aria-hidden-focus"]).analyze();
  const seriousViolations = accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact || ""));
  if (seriousViolations.length) throw new Error(`Serious accessibility violations: ${seriousViolations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => `${node.target.join(" > ")} ${node.html.slice(0, 220)}`).join(" | ")}`).join("; ")}`);
  const navigationTiming = await desktop.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return entry ? { domContentLoadedMs: entry.domContentLoadedEventEnd - entry.startTime, loadMs: entry.loadEventEnd - entry.startTime } : null;
  });
  if (navigationTiming && navigationTiming.loadMs > 10_000) throw new Error(`Local qualified page load exceeded 10s: ${navigationTiming.loadMs}ms.`);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  const assertCompactHeaderAction = async (label: string, headingName: string) => {
    const action = mobile.getByRole("button", { name: label, exact: true }).or(mobile.getByRole("link", { name: label, exact: true })).first();
    const [actionBox, headingBox] = await Promise.all([action.boundingBox(), mobile.getByRole("heading", { name: headingName, exact: true }).boundingBox()]);
    if (!actionBox || actionBox.width > 48 || actionBox.height > 48 || Math.abs(actionBox.width - actionBox.height) > 2) throw new Error(`${label} is not a compact square header action.`);
    if (!headingBox || actionBox.x <= headingBox.x) throw new Error(`${label} is not positioned to the right of the page title.`);
  };
  await mobile.goto(`${origin}/portfolios`, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("heading", { name: "Your Portfolios", exact: true }).waitFor();
  await mobile.getByText("Create a new portfolio or enter an existing organization.", { exact: true }).waitFor();
  if (await mobile.getByRole("button", { name: "Open navigation", exact: true }).count()) throw new Error("Portfolio selection still exposes organization operating navigation.");
  if (await mobile.getByRole("navigation", { name: "EOS primary navigation" }).count()) throw new Error("Portfolio selection still renders a non-functional operating rail.");
  await assertCompactHeaderAction("Create portfolio", "Your Portfolios");
  await mobile.goto(`${origin}/portfolios/${portfolioId}`, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("heading", { name: portfolioName, exact: true }).waitFor();
  await mobile.getByText("Organizations", { exact: true }).first().waitFor();
  if (await mobile.getByText("Operating contexts", { exact: true }).count()) throw new Error("The obsolete operating-context metric is still shown beside Organizations.");
  await assertCompactHeaderAction("Add organization", portfolioName);
  await mobile.goto(`${origin}/company-setup?portfolioId=${portfolioId}`, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("heading", { name: "Build the operating foundation", exact: true }).waitFor();
  await mobile.getByLabel("Step 2 of 6: Company", { exact: true }).waitFor();
  if (await mobile.getByRole("button", { name: "Open navigation", exact: true }).count()) throw new Error("Company setup exposes operating navigation before an organization exists.");
  const setupOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (setupOverflow) throw new Error("Mobile company setup has horizontal overflow.");
  await mobile.getByRole("button", { name: "Back", exact: true }).click();
  await mobile.getByLabel("Step 1 of 6: Portfolio", { exact: true }).waitFor();
  await mobile.getByText(portfolioName, { exact: true }).locator("xpath=ancestor::button[1]").click();
  await mobile.getByLabel("Step 2 of 6: Company", { exact: true }).waitFor();
  await mobile.goto(`${origin}/company/${companyId}#my-role`, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("heading", { name: "My Role", exact: true }).waitFor();
  await assertCompactHeaderAction("Refresh workspace", "My Role");
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
  await mobile.goto(`${origin}/company/${companyId}#intelligence`, { waitUntil: "domcontentloaded" });
  await mobile.getByRole("heading", { name: "Intelligence", exact: true }).waitFor();
  await mobile.getByRole("button", { name: /Open .* conversation/ }).click();
  await mobile.locator("#mobile-communication-drawer aside").waitFor();
  if (browserErrors.length) throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);
  console.log(JSON.stringify({ browserAcceptance: true, companyId, surfaces: 8, activeModules: 14, usableModuleControlCenter: true, roleSafeNextActions: true, hierarchyBuilder: true, interactiveWorkApprovalLoop: true, confirmedDecisions: { approvalPreview: true, rejectionReasonRequired: true }, guidedEvidenceCompletion: true, actionableCommandMetrics: true, guidedCompanySetup: true, reachableAccountControls: ["settings", "support"], aiSpendControls: true, auditReceipts: true, compactSquarePageActions: ["create portfolio", "add organization", "refresh workspace"], portfolioSwitching: "account panel only", desktop: "1440x1000", mobile: "390x844", movableCommunicationFab: true, fullWidthCommunicationDrawer: true, contextualCommunicationLaunch: true, accessibility: { seriousOrCritical: 0 }, navigationTiming }));
} finally {
  await browser.close();
}
