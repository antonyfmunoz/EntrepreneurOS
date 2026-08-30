import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";

const origin = process.env.EOS_E2E_CLIENT_ORIGIN || "http://127.0.0.1:5110";
const apiOrigin = process.env.EOS_E2E_API_ORIGIN || "http://127.0.0.1:5111";
const browser = await chromium.launch({ headless: true });
try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const desktop = await desktopContext.newPage();
  const browserErrors: string[] = [];
  desktop.on("pageerror", (error) => browserErrors.push(error.message));
  desktop.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  desktop.on("response", (response) => {
    if (response.status() >= 400)
      browserErrors.push(`${response.status()} ${response.url()}`);
  });
  await desktop.goto(`${origin}/portfolios`, { waitUntil: "domcontentloaded" });
  const fixture = await desktop.evaluate(async () => {
    const portfolios = await fetch("/api/portfolios").then((response) =>
      response.json(),
    );
    let selectedPortfolio: { id: number; name: string } | undefined;
    let primary: { id: number; name?: string } | undefined;
    let secondary: { id: number; name?: string } | undefined;
    for (const candidate of portfolios as Array<{ id: number; name: string }>) {
      const companies = await fetch(`/api/portfolios/${candidate.id}/companies`).then((response) => response.json());
      const candidatePrimary = companies.find((company: { name?: string }) => company.name === "EOS Browser Acceptance");
      const candidateSecondary = companies.find((company: { name?: string }) => company.name === "EOS Multi-Workspace Company");
      if (candidatePrimary && candidateSecondary) {
        selectedPortfolio = candidate;
        primary = candidatePrimary;
        secondary = candidateSecondary;
        break;
      }
    }
    if (!selectedPortfolio || !primary || !secondary)
      throw new Error(`Browser fixture portfolio is incomplete across ${portfolios.length} visible portfolio(s).`);
    return {
      companyId: primary.id as number,
      secondCompanyId: secondary.id as number,
      portfolioId: selectedPortfolio.id as number,
      portfolioName: selectedPortfolio.name as string,
    };
  });
  const { companyId, secondCompanyId, portfolioId, portfolioName } = fixture;
  await desktop.goto(`${origin}/company/${companyId}#home`, {
    waitUntil: "domcontentloaded",
  });
  try {
    await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  } catch (error) {
    await desktop.screenshot({ path: ".tmp/e2e-failure.png", fullPage: true });
    throw new Error(
      `Home did not render. URL=${desktop.url()} body=${(await desktop.locator("body").innerText()).slice(0, 1200)} browserErrors=${browserErrors.join(" | ")}`,
      { cause: error },
    );
  }
  await desktop
    .getByRole("button", { name: "Rename Assistant", exact: true })
    .click();
  await desktop
    .getByLabel("Executive Assistant name", { exact: true })
    .fill("Avery");
  await desktop
    .getByRole("button", { name: "Save Executive Assistant name", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Rename Avery", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Rename Avery", exact: true })
    .click();
  await desktop
    .getByLabel("Executive Assistant name", { exact: true })
    .fill("Assistant");
  await desktop
    .getByRole("button", { name: "Save Executive Assistant name", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Rename Assistant", exact: true })
    .waitFor();
  const decisionHud = desktop.getByLabel("Executive decision control HUD");
  await decisionHud
    .getByRole("button", { name: /Next: Advance the organization manifest/ })
    .click();
  await decisionHud
    .getByRole("button", { name: "Continue organization setup", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Organization", exact: true })
    .waitFor();
  await desktop.getByRole("link", { name: "Home", exact: true }).click();
  await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  const primaryNavigation = desktop.getByRole("navigation", {
    name: "EOS primary navigation",
  });
  if (
    await primaryNavigation
      .getByRole("link", { name: "Portfolio", exact: true })
      .count()
  )
    throw new Error(
      "Portfolio switching is still present in the EOS operating navigation.",
    );
  if (
    await primaryNavigation
      .getByRole("link", { name: "Organizations", exact: true })
      .count()
  )
    throw new Error(
      "Organization switching is still present in the EOS operating navigation.",
    );
  await desktop.getByRole("button", { name: "Account menu" }).click();
  const accountPanel = desktop.getByRole("region", { name: "account panel" });
  await accountPanel
    .getByRole("link", { name: "Portfolios", exact: true })
    .waitFor();
  await accountPanel
    .getByRole("link", { name: "Organizations", exact: true })
    .waitFor();
  const settingsLink = accountPanel.getByRole("link", {
    name: "Settings",
    exact: true,
  });
  await settingsLink.waitFor();
  await accountPanel
    .getByRole("link", { name: "Support", exact: true })
    .waitFor();
  if (
    (await settingsLink.getAttribute("href")) !==
    `/settings?companyId=${companyId}`
  )
    throw new Error(
      "Company settings did not preserve the active company context.",
    );
  await settingsLink.click();
  await desktop
    .getByRole("heading", { name: "Settings", exact: true })
    .waitFor();
  if (await desktop.getByLabel("Executive decision control HUD").count())
    throw new Error(
      "Account settings still renders a company operating HUD without company authority context.",
    );
  if (
    await desktop
      .getByRole("navigation", { name: "EOS primary navigation" })
      .count()
  )
    throw new Error(
      "Account settings still renders company operating navigation.",
    );
  if (
    await desktop
      .getByRole("button", { name: "Open navigation", exact: true })
      .count()
  )
    throw new Error(
      "Account settings still exposes an empty operating-navigation drawer.",
    );
  await desktop.getByLabel("Company context").waitFor();
  if (
    (await desktop.getByLabel("Company context").textContent()) !==
    "EOS Browser Acceptance"
  )
    throw new Error(
      "Settings did not resolve the explicitly selected company.",
    );
  await desktop
    .getByRole("button", { name: "Open in-app notifications", exact: true })
    .click();
  await desktop
    .getByRole("region", { name: "notifications panel", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Close notifications panel", exact: true })
    .click();
  if (
    await desktop.getByRole("tab", { name: "AI Autonomy", exact: true }).count()
  )
    throw new Error("The non-enforced AI autonomy control is still exposed.");
  if (
    await desktop
      .getByRole("tab", { name: "Notifications", exact: true })
      .count()
  )
    throw new Error(
      "The non-enforced outbound notification controls are still exposed.",
    );
  await desktop.getByRole("tab", { name: "Company", exact: true }).click();
  await desktop
    .getByText("Only this selected company will be changed.", { exact: true })
    .waitFor();
  if (
    (await desktop
      .getByRole("tab", { name: "Company", exact: true })
      .getAttribute("data-state")) !== "active"
  )
    throw new Error("Company settings tab did not become active.");
  if (
    (await desktop
      .getByRole("tab", { name: "Profile", exact: true })
      .getAttribute("data-state")) !== "inactive"
  )
    throw new Error(
      "Profile settings tab remained active after changing tabs.",
    );
  if (process.env.EOS_CAPTURE_VISUALS === "true")
    await desktop.screenshot({
      path: ".tmp/eos-settings-desktop.png",
      fullPage: true,
    });
  await desktop.getByRole("tab", { name: "Billing", exact: true }).click();
  await desktop
    .getByText("Billing is not available in this environment", { exact: true })
    .waitFor();
  await desktop.getByRole("tab", { name: "AI spend", exact: true }).click();
  await desktop
    .getByRole("heading", {
      name: `AI spend for EOS Browser Acceptance`,
      exact: true,
    })
    .waitFor();
  await desktop
    .getByText("Browser Reconciliation Acceptance", { exact: true })
    .waitFor();
  await desktop.getByLabel("Alert at percent").fill("75");
  await desktop
    .getByRole("button", { name: "Save AI budget", exact: true })
    .click();
  await desktop
    .getByText("AI budget updated for EOS Browser Acceptance.", { exact: true })
    .waitFor();
  await desktop.getByLabel("Actual cost (USD)").fill("0.12");
  await desktop
    .getByLabel("Secret-free evidence URL")
    .fill("https://evidence.example.test/browser-ai-reconciliation");
  await desktop
    .getByRole("button", { name: "Record reconciliation", exact: true })
    .click();
  await desktop
    .getByText("Reservation reconciled and the ledger has been recalculated.", {
      exact: true,
    })
    .waitFor();
  await desktop.getByRole("tab", { name: "Readiness", exact: true }).click();
  await desktop
    .getByRole("heading", { name: "Production readiness", exact: true })
    .waitFor();
  await desktop.getByText("Passing layers", { exact: true }).waitFor();
  await desktop
    .getByRole("heading", { name: "Vendor review", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Service ownership", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Send test alert", exact: true })
    .waitFor();
  const readinessRequirement = desktop.getByLabel(
    "Readiness control requirement",
  );
  await readinessRequirement.waitFor();
  await desktop
    .getByLabel("Secret-free HTTPS evidence URL")
    .fill(`https://evidence.example.test/browser-${Date.now()}`);
  await desktop.getByLabel("SHA-256 evidence hash").fill("d".repeat(64));
  const evidenceSubject = desktop.getByLabel("Evidence subject");
  if (!(await evidenceSubject.inputValue()))
    await evidenceSubject.fill(`Browser-reviewed evidence ${Date.now()}`);
  await desktop
    .getByRole("button", { name: "Record reviewed evidence", exact: true })
    .click();
  await desktop
    .getByText(
      /Evidence recorded for .* The 24-layer decision has been recalculated\./,
    )
    .waitFor();
  await desktop.goto(`${origin}/support`, { waitUntil: "domcontentloaded" });
  await desktop
    .getByRole("heading", { name: "Support", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Submit support request", exact: true })
    .waitFor();
  const supportSubject = `Browser support ${Date.now()}`;
  await desktop.getByLabel("Subject", { exact: true }).fill(supportSubject);
  await desktop
    .getByLabel("What happened?", { exact: true })
    .fill(
      "The browser acceptance workflow needs a two-way support response with a durable customer-visible record.",
    );
  await desktop
    .getByRole("button", { name: "Submit support request", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Request recorded", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Support conversation", exact: true })
    .waitFor();
  await desktop
    .getByLabel("Add an update")
    .fill(
      "Customer confirms the problem remains reproducible and provides the exact workflow context.",
    );
  await desktop
    .getByRole("button", { name: "Send update", exact: true })
    .click();
  await desktop.getByText("Reply sent", { exact: true }).waitFor();
  await desktop
    .getByRole("heading", { name: "Support operations", exact: true })
    .waitFor();
  await desktop
    .getByLabel("Support operations queue")
    .getByText(supportSubject, { exact: true })
    .locator("xpath=ancestor::button[1]")
    .click();
  await desktop
    .getByLabel("Reply to customer")
    .fill(
      "EOS Support reproduced the issue and recorded the next action for the customer.",
    );
  await desktop
    .getByRole("button", { name: "Send reply", exact: true })
    .click();
  await desktop
    .getByText("Reply delivered in EOS and the customer was notified.", {
      exact: true,
    })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await desktop
    .getByRole("button", {
      name: `Support replied There is an update on ${supportSubject}.`,
      exact: true,
    })
    .click();
  await desktop.waitForURL(/\/support\?ticket=/);
  await desktop
    .getByRole("heading", { name: "Support conversation", exact: true })
    .waitFor();
  await desktop.getByText(supportSubject, { exact: true }).first().waitFor();
  if (await desktop.getByLabel("Executive decision control HUD").count())
    throw new Error("Account support still renders a company operating HUD.");
  if (
    await desktop
      .getByRole("navigation", { name: "EOS primary navigation" })
      .count()
  )
    throw new Error(
      "Account support still renders company operating navigation.",
    );
  await desktop.goto(`${origin}/this-route-does-not-exist`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "Page not found", exact: true })
    .waitFor();
  if (
    await desktop
      .getByRole("link", { name: "Go to command center", exact: true })
      .count()
  )
    throw new Error(
      "The not-found recovery still points to the retired command center.",
    );
  await desktop
    .getByRole("link", { name: "Return to portfolios", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Your Portfolios", exact: true })
    .waitFor();
  await desktop.goto(`${origin}/company/${companyId}#home`, {
    waitUntil: "domcontentloaded",
  });
  await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Create mission" }).click();
  await desktop
    .getByRole("heading", { name: "Operations", exact: true })
    .waitFor();
  const capabilityName = `Browser delivery capability ${Date.now()}`;
  await desktop.getByLabel("Capability name").fill(capabilityName);
  await desktop
    .getByLabel("Capability catalog key")
    .fill(`capability:browser-delivery-${Date.now()}`);
  await desktop
    .getByLabel("Capability activation trigger")
    .fill("An approved browser acceptance mission exists");
  await desktop
    .getByLabel("Capability primary module")
    .selectOption("12");
  await desktop
    .getByRole("button", { name: "Map capability", exact: true })
    .click();
  await desktop
    .getByText("Capability instance mapped", { exact: true })
    .waitFor();
  const resourceName = `Browser delivery workspace ${Date.now()}`;
  await desktop.getByLabel("Resource name").fill(resourceName);
  await desktop
    .getByLabel("Resource rights and usage")
    .fill("Authorized for this tenant's browser acceptance work");
  await desktop
    .getByRole("button", { name: "Register resource", exact: true })
    .click();
  await desktop.getByText("Resource registered", { exact: true }).waitFor();
  const processName = `Browser accepted delivery ${Date.now()}`;
  await desktop
    .getByLabel("Process capability")
    .selectOption({ label: capabilityName });
  await desktop.getByLabel("Process name").fill(processName);
  await desktop
    .getByLabel("Process purpose")
    .fill("Prove that an operator can execute work from the rendered SOP");
  await desktop
    .getByLabel("Process intended outcome")
    .fill("The browser acceptance result is reviewed and accepted");
  await desktop
    .getByLabel("Process trigger")
    .fill("The governed Work Packet enters ready state");
  await desktop
    .getByLabel("First procedure step")
    .fill(
      "Execute the browser acceptance fixture and record the observed result",
    );
  await desktop
    .getByRole("button", { name: "Map executable process", exact: true })
    .click();
  await desktop
    .getByText("Executable process mapped", { exact: true })
    .waitFor();
  const missionTitle = `Interactive MVP ${Date.now()}`;
  await desktop.getByPlaceholder("Mission title").fill(missionTitle);
  await desktop
    .getByPlaceholder("Objective and intended outcome")
    .fill("Verify the interactive decision, work, approval, and audit loop.");
  await desktop
    .getByLabel("Expected Work Packet output")
    .fill("A reviewed browser acceptance result");
  await desktop
    .getByLabel("Work Packet acceptance criteria")
    .fill("The exact process version completes with observed evidence");
  const resourceAllocation = desktop.getByLabel(resourceName, { exact: true });
  if (!(await resourceAllocation.isChecked())) await resourceAllocation.check();
  await desktop.getByRole("button", { name: "Create Work Packet" }).click();
  await desktop.getByText(missionTitle, { exact: true }).waitFor();
  await desktop.getByRole("link", { name: "Command", exact: true }).click();
  await desktop
    .getByRole("heading", { name: "Command", exact: true })
    .waitFor();
  const reviewPendingDecisions = decisionHud.getByRole("button", {
    name: /Review \d+ pending decision/,
  });
  if (!(await reviewPendingDecisions.isVisible())) {
    const decisionHudToggle = decisionHud.locator("button[aria-expanded]");
    if ((await decisionHudToggle.getAttribute("aria-expanded")) !== "true")
      await decisionHudToggle.click();
  }
  await reviewPendingDecisions.click();
  await desktop
    .getByRole("heading", { name: "Review Room", exact: true })
    .waitFor();
  const approvalCard = desktop
    .getByText(`Authorize work packet: ${missionTitle}`, { exact: true })
    .locator("xpath=ancestor::*[.//button[normalize-space()='Approve']][1]");
  await approvalCard.waitFor();
  await approvalCard
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  const approvalDialog = desktop.getByRole("alertdialog");
  await approvalDialog
    .getByRole("heading", { name: "Confirm approval", exact: true })
    .waitFor();
  await approvalDialog
    .getByLabel("Decision note (optional)")
    .fill(
      "Approved in browser acceptance after reviewing the objective and authority boundary.",
    );
  await approvalDialog
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await desktop.getByText("Work approved", { exact: true }).waitFor();
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText(missionTitle, { exact: true })
    .locator("xpath=ancestor::button[1]")
    .click();
  const selectedWorkHeading = desktop.getByRole("heading", {
    name: missionTitle,
    exact: true,
  });
  await selectedWorkHeading.waitFor();
  await desktop
    .getByRole("button", { name: "Start / resume work", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Submit work for review", exact: true })
    .click();
  await desktop
    .getByLabel(`Work Room evidence for ${missionTitle}`)
    .fill("Browser acceptance verified the governed work result.");
  await desktop
    .getByRole("button", { name: "Record required evidence", exact: true })
    .click();
  await desktop
    .getByText("Required evidence recorded", { exact: true })
    .waitFor();
  await desktop
    .getByText(
      "All required evidence is recorded. Submit or complete the work when ready.",
      { exact: true },
    )
    .waitFor();
  await desktop
    .getByRole("button", { name: "Complete work", exact: true })
    .click();
  await selectedWorkHeading.waitFor({ state: "detached" });
  await desktop.getByRole("link", { name: "Operations", exact: true }).click();
  await desktop.getByRole("button", { name: /Show closed work/ }).click();
  await desktop
    .getByText(missionTitle, { exact: true })
    .locator("xpath=ancestor::*[.//*[normalize-space()='completed']][1]")
    .waitFor();
  const rejectedMissionTitle = `Rejected MVP ${Date.now()}`;
  await desktop.getByPlaceholder("Mission title").fill(rejectedMissionTitle);
  await desktop
    .getByPlaceholder("Objective and intended outcome")
    .fill(
      "Verify that rejection requires an auditable reason and an explicit confirmation.",
    );
  await desktop
    .getByRole("button", { name: "Create Work Packet", exact: true })
    .click();
  const rejectionCard = desktop
    .getByText(`Authorize work packet: ${rejectedMissionTitle}`, {
      exact: true,
    })
    .locator("xpath=ancestor::*[.//button[normalize-space()='Reject']][1]");
  await rejectionCard
    .getByRole("button", { name: "Reject", exact: true })
    .click();
  const rejectionDialog = desktop.getByRole("alertdialog");
  const confirmRejection = rejectionDialog.getByRole("button", {
    name: "Confirm rejection",
    exact: true,
  });
  if (await confirmRejection.isEnabled())
    throw new Error(
      "Rejection confirmation was enabled without an auditable reason.",
    );
  await rejectionDialog
    .getByLabel("Rejection reason")
    .fill(
      "The objective needs a measurable customer outcome before work begins.",
    );
  await confirmRejection.click();
  await desktop.getByText("Work rejected", { exact: true }).waitFor();
  await desktop
    .getByRole("link", { name: "Organization", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Organization", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Team access", exact: true })
    .waitFor();
  await desktop.getByText("Human identities", { exact: true }).waitFor();
  await desktop
    .getByText("Portfolio-wide executive access", { exact: true })
    .waitFor();
  await desktop
    .getByLabel("Approved employee email domains")
    .fill("example.test");
  await desktop
    .getByRole("button", { name: "Save identity policy", exact: true })
    .click();
  await desktop.getByText("Identity policy saved", { exact: true }).waitFor();
  await desktop
    .getByRole("button", {
      name: "Suspend browser-external@example.test",
      exact: true,
    })
    .click();
  await desktop
    .getByRole("button", {
      name: "Reactivate browser-external@example.test",
      exact: true,
    })
    .waitFor();
  await desktop
    .getByRole("button", {
      name: "Reactivate browser-external@example.test",
      exact: true,
    })
    .click();
  await desktop
    .getByRole("button", {
      name: "Suspend browser-external@example.test",
      exact: true,
    })
    .waitFor();
  const seatTitle = `Browser QA ${Date.now()}`;
  await desktop
    .getByPlaceholder("Seat title, e.g. Head of Growth")
    .fill(seatTitle);
  await desktop.getByPlaceholder("Role Agent name").fill("Quinn");
  await desktop
    .getByRole("button", { name: "Create accountable seat" })
    .click();
  await desktop.getByText(seatTitle, { exact: true }).first().waitFor();
  const inviteEmail = `browser-invite-${Date.now()}@example.test`;
  await desktop.getByPlaceholder("Work email address").fill(inviteEmail);
  await desktop
    .getByLabel("Seat for invitation")
    .selectOption({ label: seatTitle });
  await desktop
    .getByRole("button", { name: "Send secure invitation", exact: true })
    .click();
  await desktop.getByText("Invitation sent", { exact: true }).waitFor();
  await desktop.getByText(inviteEmail, { exact: true }).waitFor();
  await desktop
    .getByRole("button", {
      name: `Revoke invitation for ${inviteEmail}`,
      exact: true,
    })
    .click();
  await desktop.getByText("Invitation revoked", { exact: true }).waitFor();
  await desktop
    .getByText(inviteEmail, { exact: true })
    .waitFor({ state: "detached" });
  await desktop.getByRole("link", { name: "Talent", exact: true }).click();
  await desktop.getByRole("heading", { name: "Talent", exact: true }).waitFor();
  await desktop
    .getByRole("heading", { name: "Institutional need graph", exact: true })
    .waitFor();
  await desktop.getByText("Human review packet", { exact: true }).waitFor();
  await desktop.getByText("Governed paid trial", { exact: true }).waitFor();
  const talentNeedTitle = `Browser capability gap ${Date.now()}`;
  await desktop
    .getByLabel("Talent need title", { exact: true })
    .fill(talentNeedTitle);
  await desktop
    .getByLabel("Talent need target seat", { exact: true })
    .selectOption({ label: seatTitle });
  await desktop
    .getByLabel("Talent need rationale", { exact: true })
    .fill(
      "The organization needs a named owner for a recurring verified outcome.",
    );
  await desktop
    .getByLabel("Talent need outcome", { exact: true })
    .fill("One accepted operating output every week");
  await desktop
    .getByRole("button", { name: "Record capability gap", exact: true })
    .click();
  await desktop.getByText("Capability gap recorded", { exact: true }).waitFor();
  const talentNeedCard = desktop
    .getByText(talentNeedTitle, { exact: true })
    .locator("xpath=ancestor::*[.//button][1]");
  await talentNeedCard
    .getByRole("button", { name: "validated", exact: true })
    .click();
  await talentNeedCard
    .getByRole("button", { name: "open", exact: true })
    .click();
  const talentCandidateName = `Browser Candidate ${Date.now()}`;
  await desktop
    .getByLabel("Candidate name", { exact: true })
    .fill(talentCandidateName);
  await desktop
    .getByLabel("Candidate identity reference", { exact: true })
    .fill(`browser-candidate-${Date.now()}@example.test`);
  await desktop
    .getByLabel("Candidate talent need", { exact: true })
    .selectOption({ label: talentNeedTitle });
  await desktop
    .getByLabel("Candidate summary", { exact: true })
    .fill(
      "Candidate-provided operating history for a controlled acceptance flow.",
    );
  await desktop
    .getByLabel("Candidate role hypothesis", { exact: true })
    .fill("Potential fit for the bounded operating-output seat.");
  await desktop
    .getByRole("button", { name: "Enter candidate once", exact: true })
    .click();
  await desktop.getByText("Candidate entered", { exact: true }).waitFor();
  await desktop
    .getByRole("paragraph")
    .filter({ hasText: talentCandidateName })
    .waitFor();
  await desktop.getByRole("link", { name: "Workforce", exact: true }).click();
  await desktop
    .getByRole("heading", { name: "Performance to succession", exact: true })
    .waitFor();
  const workforceReviewSummary = `Browser role review ${Date.now()}`;
  await desktop.getByText("Draft a review", { exact: true }).click();
  await desktop
    .getByLabel("Review subject seat", { exact: true })
    .selectOption({ label: "Founder / Portfolio Principal" });
  await desktop
    .getByLabel("Review outcome summary", { exact: true })
    .fill(workforceReviewSummary);
  await desktop
    .getByRole("button", { name: "Draft review", exact: true })
    .click();
  await desktop.getByText("Review drafted", { exact: true }).waitFor();
  await desktop.getByText(workforceReviewSummary, { exact: true }).waitFor();
  await desktop
    .getByLabel("Workforce")
    .getByRole("button", { name: "Ask Assistant", exact: true })
    .waitFor();
  const modulesLink = desktop.getByRole("link", {
    name: "Modules",
    exact: true,
  });
  if (!(await modulesLink.count())) {
    const debugContext = await desktop.evaluate(
      async (id) =>
        fetch(`/api/eos/companies/${id}/context`).then((response) =>
          response.json(),
        ),
      companyId,
    );
    throw new Error(
      `Modules navigation is unavailable. allowedSurfaces=${JSON.stringify(debugContext?.principalContext?.allowedSurfaces)} navigation=${JSON.stringify(await primaryNavigation.innerText())}`,
    );
  }
  await modulesLink.click();
  await desktop
    .getByRole("heading", { name: "Modules", exact: true })
    .waitFor();
  const moduleLaunchers = desktop.getByRole("button", {
    name: "Open module",
    exact: true,
  });
  if ((await moduleLaunchers.count()) !== 14)
    throw new Error(
      "The founder module control center did not expose all fourteen active overlay modules.",
    );
  const customerSuccessModule = desktop
    .getByText("Customer Success, Reporting & Renewal", { exact: true })
    .locator("xpath=ancestor::*[.//button[normalize-space()='Open module']][1]");
  await customerSuccessModule.getByRole("button", { name: "Open module", exact: true }).click();
  await desktop.getByRole("heading", { name: "Customer success accounts", exact: true }).waitFor();
  await desktop.getByLabel("Canonical customer relationship", { exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Create account", exact: true }).waitFor();
  const productEvolutionModule = desktop
    .getByText("Product, Offer & Template Evolution", { exact: true })
    .locator("xpath=ancestor::*[.//button[normalize-space()='Open module']][1]");
  await productEvolutionModule.getByRole("button", { name: "Open module", exact: true }).click();
  await desktop.getByRole("heading", { name: "Offer learning inbox", exact: true }).waitFor();
  const canonicalOffer = desktop.getByLabel("Canonical offer", { exact: true });
  await canonicalOffer.waitFor();
  if ((await canonicalOffer.locator("option").count()) > 1) {
    await canonicalOffer.selectOption({ index: 1 });
    await desktop.getByRole("heading", { name: "Versioned change proposals", exact: true }).waitFor();
    await desktop.getByText("Record feedback signal", { exact: true }).waitFor();
    await desktop.getByText("Draft proposal from selected offer", { exact: true }).waitFor();
  }
  const complianceModule = desktop
    .getByText("Legal Obligations, Rights & Compliance", { exact: true })
    .locator("xpath=ancestor::*[.//button[normalize-space()='Open module']][1]");
  await complianceModule.getByRole("button", { name: "Open module", exact: true }).click();
  await desktop.getByRole("heading", { name: "Authoritative source custody", exact: true }).waitFor();
  await desktop.getByRole("heading", { name: "Company requirements register", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Prepare source draft", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Register requirement", exact: true }).waitFor();
  const technologyModule = desktop
    .getByText("Technology, Integrations & Automation Control", { exact: true })
    .locator(
      "xpath=ancestor::*[.//button[normalize-space()='Open module']][1]",
    );
  await technologyModule
    .getByRole("button", { name: "Open module", exact: true })
    .click();
  await desktop
    .getByRole("heading", {
      name: "Technology, Integrations & Automation Control",
      exact: true,
    })
    .first()
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Adapter contract and live mode", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Signed adapter event ingress", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Provider-native ingress", exact: true })
    .waitFor();
  await desktop.getByLabel("Integration binding", { exact: true }).waitFor();
  await desktop
    .getByText("Provider execution boundary", { exact: true })
    .waitFor();
  await desktop.getByText(/Native dispatch is disabled in this deployment/).waitFor();
  await desktop.getByText(/gmail\.send/).waitFor();
  await desktop
    .getByRole("heading", { name: "Artifact closure & pre-live activation", exact: true })
    .waitFor();
  const initializeCompanyCoverage = desktop.getByRole("button", {
    name: "Initialize entire company",
    exact: true,
  });
  await initializeCompanyCoverage.waitFor();
  await initializeCompanyCoverage.click();
  const initializeMappedCapabilities = desktop.getByRole("button", {
    name: "Initialize this module",
    exact: true,
  });
  await initializeMappedCapabilities.waitFor();
  await initializeMappedCapabilities.click();
  await desktop.getByText(/capability:browser-delivery-capability/).first().waitFor();
  const initializeClosure = desktop.getByRole("button", {
    name: "Initialize custom matrix",
    exact: true,
  });
  await initializeClosure.waitFor();
  await initializeClosure.click();
  await desktop.getByText("module-12", { exact: true }).first().waitFor();
  await desktop.getByText(/22\/22 classes/).first().waitFor();
  await desktop.getByText("closure in progress", { exact: true }).first().waitFor();
  await desktop.getByRole("heading", { name: "Pre-live qualification campaign", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Create qualification campaign", exact: true }).click();
  const qualificationCampaign = desktop.getByLabel("Qualification campaign", { exact: true });
  await qualificationCampaign.waitFor();
  if (!(await qualificationCampaign.locator("option:checked").textContent())?.includes("Company pre-live qualification"))
    throw new Error("The governed qualification campaign was not selected after creation.");
  await desktop.getByRole("button", { name: "Start seven-scenario rehearsal", exact: true }).waitFor();
  if (process.env.EOS_CAPTURE_VISUALS === "true")
    await desktop.screenshot({
      path: ".tmp/eos-modules-desktop.png",
      fullPage: true,
    });
  await desktop
    .getByRole("button", { name: "Prepare governed mission", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Operations", exact: true })
    .waitFor();
  if (
    (await desktop.getByPlaceholder("Mission title").inputValue()) !==
    "Module 12: Qualify an integration or automation"
  )
    throw new Error("Module 12 did not prepare its governed Work Packet.");
  if (
    !(await desktop
      .getByPlaceholder("Objective and intended outcome")
      .inputValue())
  )
    throw new Error("The module Work Packet objective was not prepared.");
  await desktop
    .getByText("Health check, authority proof, and recovery result", {
      exact: true,
    })
    .waitFor();
  await desktop.getByRole("link", { name: "My Role", exact: true }).click();
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  const roleActions = desktop
    .getByRole("heading", { name: "My next move", exact: true })
    .locator(
      "xpath=ancestor::*[.//button[normalize-space()='Open assigned work']][1]",
    );
  await roleActions
    .getByRole("button", { name: "Practice this role", exact: true })
    .waitFor();
  await roleActions
    .getByRole("button", { name: "Ask Assistant", exact: true })
    .waitFor();
  await roleActions
    .getByRole("button", { name: "Open assigned work", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Work Room", exact: true })
    .waitFor();
  for (const surface of [
    "Review Room",
    "Academy",
    "Portfolio Map",
    "Systems",
  ]) {
    await desktop.getByRole("link", { name: surface, exact: true }).click();
    await desktop
      .getByRole("heading", { name: surface, exact: true })
      .waitFor();
    if (surface === "Academy")
      await desktop
        .getByRole("button", { name: "Start practical exercise", exact: true })
        .waitFor();
    if (surface === "Portfolio Map") {
      await desktop
        .getByRole("button", { name: "Open organization", exact: true })
        .waitFor();
      await desktop
        .getByLabel("Search visible seats", { exact: true })
        .fill(seatTitle);
      await desktop
        .getByText(seatTitle, { exact: true })
        .locator("xpath=ancestor::button[1]")
        .click();
      await desktop
        .getByRole("heading", { name: seatTitle, exact: true })
        .waitFor();
      await desktop
        .getByRole("button", {
          name: "Ask Assistant about this seat",
          exact: true,
        })
        .waitFor();
    }
  }
  await desktop
    .getByRole("heading", {
      name: "Enterprise architecture inventory",
      exact: true,
    })
    .waitFor();
  const browserSystemName = `Browser CRM ${Date.now()}`;
  await desktop.getByLabel("System name").fill(browserSystemName);
  await desktop
    .getByLabel("System capability")
    .fill("Customer relationship management");
  await desktop
    .getByLabel("System data domain")
    .fill("Customer and opportunity data");
  await desktop
    .getByLabel("System authoritative field")
    .fill("Provider contact ID");
  await desktop
    .getByLabel("System replacement intent")
    .selectOption("integrate");
  await desktop
    .getByRole("button", { name: "Register system", exact: true })
    .click();
  await desktop
    .getByRole("paragraph")
    .filter({ hasText: browserSystemName })
    .waitFor();
  const browserBindingName = `Browser CRM adapter ${Date.now()}`;
  await desktop.getByLabel("Integration name").fill(browserBindingName);
  await desktop
    .getByLabel("Integration system")
    .selectOption({ label: browserSystemName });
  await desktop.getByLabel("Integration provider").fill("browser-fixture");
  await desktop
    .getByLabel("Integration adapter reference")
    .fill("eos-browser-fixture-v1");
  await desktop
    .getByLabel("Integration manual fallback")
    .fill(
      "Create the qualification Work Packet manually and retain the provider reference.",
    );
  await desktop
    .getByLabel("Integration failure recovery")
    .fill(
      "Pause effects, alert the owner, preserve correlation IDs, and reconcile before retry.",
    );
  await desktop
    .getByRole("button", { name: "Register integration binding", exact: true })
    .click();
  await desktop
    .getByRole("paragraph")
    .filter({ hasText: browserBindingName })
    .waitFor();
  const browserBindingCard = desktop
    .getByRole("paragraph")
    .filter({ hasText: browserBindingName })
    .locator(
      "xpath=ancestor::div[.//button[normalize-space()='Configure adapter']][1]",
    );
  await browserBindingCard
    .getByRole("button", { name: "Configure adapter", exact: true })
    .click();
  await desktop.getByLabel("Adapter version", { exact: true }).fill("1.0.0");
  await desktop
    .getByLabel("Transport", { exact: true })
    .fill("Controlled browser fixture transport");
  await desktop
    .getByRole("button", {
      name: "Save governed configuration",
      exact: true,
    })
    .click();
  await desktop
    .getByText("Integration configuration saved", { exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Health and recovery evidence", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", {
      name: "Tool entitlement / connection",
      exact: true,
    })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Automation control plane", exact: true })
    .waitFor();
  const notionCard = desktop
    .getByRole("heading", { name: "Notion", exact: true })
    .locator("xpath=ancestor::*[.//button[normalize-space()='Disconnect']][1]");
  await notionCard
    .getByText("EOS Acceptance Workspace", { exact: true })
    .waitFor();
  await notionCard
    .getByRole("button", { name: "Verify connection", exact: true })
    .click();
  await desktop.getByText("Notion verified", { exact: true }).waitFor();
  await desktop
    .getByLabel("Search connected Notion workspace")
    .fill("Quarterly plan");
  await desktop
    .getByRole("button", { name: "Load workspace", exact: true })
    .click();
  await desktop
    .getByText("Quarterly plan operating plan", { exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Open in Notion", exact: true })
    .waitFor();
  await notionCard
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await desktop.getByText("Notion disconnected", { exact: true }).waitFor();
  await desktop
    .getByRole("button", { name: "Connect Notion", exact: true })
    .waitFor();
  await desktop.getByLabel("Monthly limit (USD)").fill("30");
  await desktop.getByLabel("Per-request limit (USD)").fill("2");
  await desktop.getByRole("button", { name: "Save spend controls" }).click();
  await desktop.getByText("Spent this month:", { exact: false }).waitFor();
  await desktop.getByRole("link", { name: "Review Room", exact: true }).click();
  await desktop
    .getByRole("heading", { name: "Recent control receipts" })
    .waitFor();
  await desktop
    .getByText("ai budget.updated", { exact: true })
    .first()
    .waitFor();
  const legacySurfaceRedirects = [
    { path: "org", hash: "organization", heading: "Organization" },
    { path: "chat", hash: "intelligence", heading: "Intelligence" },
    { path: "workflows/new", hash: "operations", heading: "Operations" },
    { path: "tasks/new", hash: "work-room", heading: "Work Room" },
  ];
  for (const legacy of legacySurfaceRedirects) {
    await desktop.goto(`${origin}/company/${companyId}/${legacy.path}`, {
      waitUntil: "domcontentloaded",
    });
    try {
      await desktop
        .getByRole("heading", { name: legacy.heading, exact: true })
        .waitFor();
    } catch (error) {
      throw new Error(
        `Legacy ${legacy.path} did not render ${legacy.heading}. URL=${desktop.url()} browserErrors=${browserErrors.slice(-10).join(" | ")} body=${(await desktop.locator("body").innerText()).slice(0, 1400)}`,
        { cause: error },
      );
    }
    if (new URL(desktop.url()).hash !== `#${legacy.hash}`)
      throw new Error(
        `Legacy ${legacy.path} did not converge on the ${legacy.hash} EOS surface.`,
      );
  }
  await desktop.goto(`${origin}/company/${companyId}#capital`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "Capital & Investor Relations", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Cash to allocation", exact: true })
    .waitFor();
  const financeSourceName = `Browser finance source ${Date.now()}`;
  await desktop.getByLabel("Financial source name").fill(financeSourceName);
  await desktop
    .getByLabel("Financial legal entity")
    .fill("Browser Acceptance LLC");
  await desktop
    .getByRole("button", { name: "Draft source boundary", exact: true })
    .click();
  try {
    await desktop
      .getByRole("paragraph")
      .filter({ hasText: financeSourceName })
      .waitFor();
  } catch (error) {
    throw new Error(
      `Financial source did not render. browserErrors=${browserErrors.slice(-10).join(" | ")} body=${(await desktop.locator("body").innerText()).slice(-1800)}`,
      { cause: error },
    );
  }
  const financePlanName = `Browser operating budget ${Date.now()}`;
  await desktop.getByLabel("Financial plan name").fill(financePlanName);
  await desktop
    .getByLabel("Financial plan source")
    .selectOption({ label: financeSourceName });
  await desktop.getByLabel("Financial planned amount").fill("50000");
  await desktop.getByLabel("Financial plan start").fill("2026-10-01");
  await desktop.getByLabel("Financial plan end").fill("2027-01-01");
  await desktop
    .getByLabel("Financial plan line item")
    .fill("Delivery capacity");
  await desktop.getByLabel("Financial plan line amount").fill("50000");
  await desktop
    .getByLabel("Financial plan assumption")
    .fill(
      "Delivery demand remains a planning assumption until reconciled to authoritative provider facts.",
    );
  await desktop
    .getByRole("button", { name: "Draft financial plan", exact: true })
    .click();
  const financePlanCard = desktop
    .getByText(financePlanName, { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await financePlanCard.waitFor();
  await financePlanCard
    .getByRole("button", { name: "review", exact: true })
    .click();
  await financePlanCard
    .getByRole("button", { name: "approved", exact: true })
    .click();
  await financePlanCard
    .getByText("approved", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByRole("heading", {
      name: "Investor Relations remains dormant",
      exact: true,
    })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Prepare readiness mission", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Operations", exact: true })
    .waitFor();
  if (
    (await desktop.getByPlaceholder("Mission title").inputValue()) !==
    "Define capital readiness boundary"
  )
    throw new Error(
      "Dormant capital preparation did not create a bounded internal Work Packet draft.",
    );
  const desktopOverflow = await desktop.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (desktopOverflow)
    throw new Error("Desktop workspace has horizontal overflow.");
  // Radix Toast injects two aria-hidden focus guards with tabindex=0 to keep
  // keyboard focus inside transient announcements. Axe flags that deliberate
  // focus-management mechanism even though the guards have no user content.
  // All remaining WCAG A/AA rules remain release-blocking.
  const accessibility = await new AxeBuilder({ page: desktop })
    .disableRules(["aria-hidden-focus"])
    .analyze();
  const seriousViolations = accessibility.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact || ""),
  );
  if (seriousViolations.length)
    throw new Error(
      `Serious accessibility violations: ${seriousViolations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => `${node.target.join(" > ")} ${node.html.slice(0, 220)}`).join(" | ")}`).join("; ")}`,
    );
  const navigationTiming = await desktop.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    return entry
      ? {
          domContentLoadedMs: entry.domContentLoadedEventEnd - entry.startTime,
          loadMs: entry.loadEventEnd - entry.startTime,
        }
      : null;
  });
  if (navigationTiming && navigationTiming.loadMs > 10_000)
    throw new Error(
      `Local qualified page load exceeded 10s: ${navigationTiming.loadMs}ms.`,
    );

  const switchPrincipal = async (
    role:
      | "owner"
      | "portfolio"
      | "executive"
      | "functional"
      | "manager"
      | "employee"
      | "external",
    activeCompanyId = companyId,
    expectedRoleOverride?: string,
  ) => {
    const response = await desktop.evaluate(async (principalRole) => {
      const result = await fetch("/api/__fixture/principal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: principalRole }),
      });
      return {
        ok: result.ok,
        status: result.status,
        body: await result.text(),
      };
    }, role);
    if (!response.ok)
      throw new Error(
        `Could not switch the browser fixture to ${role}: ${response.status} ${response.body}`,
      );
    const resolvedRole = await desktop.evaluate(async (activeCompanyId) => {
      const result = await fetch(
        `/api/eos/companies/${activeCompanyId}/context`,
      );
      const body = await result.json();
      return {
        ok: result.ok,
        status: result.status,
        role: body?.principalContext?.role,
        body,
      };
    }, activeCompanyId);
    const expectedRole =
      expectedRoleOverride ||
      {
        owner: "founder",
        portfolio: "portfolio_executive",
        executive: "company_ceo",
        functional: "functional_executive",
        manager: "manager",
        employee: "individual_contributor",
        external: "external",
      }[role];
    if (!resolvedRole.ok || resolvedRole.role !== expectedRole)
      throw new Error(
        `Browser fixture principal ${role} resolved as ${resolvedRole.status} ${resolvedRole.role || JSON.stringify(resolvedRole.body)}.`,
      );
    await desktop.reload({ waitUntil: "domcontentloaded" });
  };
  const expectNavigation = async (visible: string[], hidden: string[]) => {
    const roleNavigation = desktop.getByRole("navigation", {
      name: "EOS primary navigation",
    });
    await roleNavigation.waitFor();
    const renderedNavigation = await roleNavigation.innerText();
    for (const label of visible)
      if (!renderedNavigation.includes(label))
        throw new Error(
          `${label} is absent from this role's compiled navigation. Rendered navigation: ${renderedNavigation}`,
        );
    for (const label of hidden)
      if (renderedNavigation.includes(label))
        throw new Error(
          `${label} is visible outside this role's compiled surface policy.`,
        );
  };
  const expectRenderedText = async (value: string) => {
    const body = await desktop.locator("body").innerText();
    if (!body.includes(value))
      throw new Error(
        `Expected rendered text ${JSON.stringify(value)} was absent. URL=${desktop.url()} body=${body.slice(0, 1800)}`,
      );
  };

  await switchPrincipal("portfolio");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Portfolio Executive");
  await desktop.getByText("Iris", { exact: true }).first().waitFor();
  await expectNavigation(
    [
      "Home",
      "Command",
      "Organization",
      "Talent",
      "Workforce",
      "My Role",
      "Modules",
      "Operations",
      "Work Room",
      "Review Room",
      "Academy",
      "Portfolio Map",
      "Capital & Investor Relations",
      "Intelligence",
      "Systems",
    ],
    ["Stakeholder / Commercial"],
  );
  const portfolioContext = await desktop.evaluate(
    async (activeCompanyId) =>
      fetch(`/api/eos/companies/${activeCompanyId}/context`).then((response) =>
        response.json(),
      ),
    companyId,
  );
  if (portfolioContext.portfolio?.ownerId !== undefined)
    throw new Error(
      "A portfolio executive received the founder's portfolio owner identifier.",
    );
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText("Set the quarterly operating direction", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByText("Deliver the shared implementation artifact", { exact: true })
    .first()
    .waitFor();

  await switchPrincipal("functional");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Chief Operating Officer");
  await desktop.getByText("Mira", { exact: true }).first().waitFor();
  await expectNavigation(
    [
      "Home",
      "Command",
      "Organization",
      "Talent",
      "Workforce",
      "My Role",
      "Modules",
      "Operations",
      "Work Room",
      "Review Room",
      "Academy",
      "Intelligence",
      "Systems",
    ],
    [
      "Stakeholder / Commercial",
      "Portfolio Map",
      "Capital & Investor Relations",
    ],
  );
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText("Align the operating function", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByText("Stabilize the weekly delivery cadence", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByText("Complete the customer handoff checklist", { exact: true })
    .first()
    .waitFor();
  if (
    await desktop
      .getByText("Set the quarterly operating direction", { exact: true })
      .count()
  )
    throw new Error("A functional executive can see upward Company CEO work.");

  await switchPrincipal("executive");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Company CEO");
  await desktop.getByText("Sage", { exact: true }).first().waitFor();
  await expectNavigation(
    [
      "Home",
      "Command",
      "Organization",
      "Talent",
      "Workforce",
      "My Role",
      "Modules",
      "Stakeholder / Commercial",
      "Operations",
      "Work Room",
      "Review Room",
      "Academy",
      "Intelligence",
      "Systems",
    ],
    ["Portfolio Map"],
  );
  if (
    await desktop
      .getByRole("button", { name: "Rename Sage", exact: true })
      .count()
  )
    throw new Error(
      "A company executive can rename a role agent outside the founder-owned Executive Assistant setting.",
    );
  await desktop
    .getByLabel("Current workspace")
    .getByRole("link", { name: portfolioName, exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Account menu", exact: true })
    .click();
  const executiveAccountPanel = desktop.getByRole("region", {
    name: "account panel",
    exact: true,
  });
  await executiveAccountPanel
    .getByRole("link", { name: "Organizations", exact: true })
    .waitFor();
  await executiveAccountPanel
    .getByRole("link", { name: "Portfolios", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Your Portfolios", exact: true })
    .waitFor();
  await desktop.getByText("1 organization · member", { exact: true }).waitFor();
  await desktop.getByRole("link", { name: new RegExp(portfolioName) }).click();
  await desktop
    .getByRole("heading", { name: portfolioName, exact: true })
    .waitFor();
  await desktop.getByText("EOS Browser Acceptance", { exact: true }).waitFor();
  if (
    await desktop
      .getByRole("link", { name: "Add organization", exact: true })
      .count()
  )
    throw new Error(
      "A company executive can add an organization to a member-scoped portfolio.",
    );
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText("Set the quarterly operating direction", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByText("Complete the customer handoff checklist", { exact: true })
    .first()
    .waitFor();

  await switchPrincipal("manager");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Operations Manager");
  await desktop.getByText("Atlas", { exact: true }).first().waitFor();
  await expectNavigation(
    [
      "Home",
      "Talent",
      "Workforce",
      "My Role",
      "Modules",
      "Operations",
      "Work Room",
      "Review Room",
      "Academy",
      "Intelligence",
    ],
    [
      "Command",
      "Organization",
      "Stakeholder / Commercial",
      "Portfolio Map",
      "Capital & Investor Relations",
      "Systems",
    ],
  );
  await desktop.goto(origin, { waitUntil: "domcontentloaded" });
  await desktop
    .getByRole("heading", { name: "Your Portfolios", exact: true })
    .waitFor();
  await desktop
    .getByText("2 organizations · member", { exact: true })
    .waitFor();
  await desktop.getByRole("link", { name: new RegExp(portfolioName) }).click();
  await desktop
    .getByRole("heading", { name: portfolioName, exact: true })
    .waitFor();
  await desktop.getByText("EOS Browser Acceptance", { exact: true }).waitFor();
  await desktop
    .getByText("EOS Multi-Workspace Company", { exact: true })
    .waitFor();
  await desktop
    .getByRole("link", { name: /EOS Multi-Workspace Company/ })
    .click();
  await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  await desktop
    .getByLabel("Current workspace")
    .getByRole("link", { name: "EOS Multi-Workspace Company", exact: true })
    .waitFor();
  await desktop.getByRole("link", { name: "My Role", exact: true }).click();
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Transformation Executive");
  await desktop.getByText("Helix", { exact: true }).first().waitFor();
  await switchPrincipal("manager", secondCompanyId, "functional_executive");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await desktop.getByRole("button", { name: "Search", exact: true }).click();
  const managerSearchPanel = desktop.getByRole("region", {
    name: "search panel",
    exact: true,
  });
  const managerSearch = managerSearchPanel.getByPlaceholder(
    "Search workspaces and actions",
  );
  await managerSearch.fill("Systems");
  await managerSearchPanel
    .getByText("No matching workspace.", { exact: true })
    .waitFor();
  await managerSearch.fill("Operations");
  await managerSearchPanel.getByRole("link", { name: /Operations/ }).waitFor();
  await managerSearchPanel
    .getByRole("button", { name: "Close search panel", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Account menu", exact: true })
    .click();
  const managerAccountPanel = desktop.getByRole("region", {
    name: "account panel",
    exact: true,
  });
  const managerSettings = managerAccountPanel.getByRole("link", {
    name: "Settings",
    exact: true,
  });
  if ((await managerSettings.getAttribute("href")) !== "/settings")
    throw new Error(
      "A manager's account settings link carries an owner-only company context.",
    );
  await managerSettings.click();
  await desktop
    .getByRole("heading", { name: "Settings", exact: true })
    .waitFor();
  await desktop.getByRole("tab", { name: "Profile", exact: true }).waitFor();
  if (await desktop.getByRole("tab", { name: "Company", exact: true }).count())
    throw new Error(
      "A manager without an owned organization is offered owner-only company settings.",
    );
  if (await desktop.getByRole("tab", { name: "AI spend", exact: true }).count())
    throw new Error(
      "A manager without an owned organization is offered owner-only AI spend controls.",
    );
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Review assigned decisions", exact: true })
    .click();
  await desktop
    .getByRole("heading", { name: "Review Room", exact: true })
    .waitFor();
  await desktop
    .getByText("Approve the customer handoff release.", { exact: true })
    .waitFor();
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText("Stabilize the weekly delivery cadence", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByText("Complete the customer handoff checklist", { exact: true })
    .first()
    .waitFor();
  if (
    await desktop
      .getByText("Set the quarterly operating direction", { exact: true })
      .count()
  )
    throw new Error(
      "A manager can see upward executive work outside the manager's reporting tree.",
    );

  await switchPrincipal("employee");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Customer Operations Specialist");
  await desktop.getByText("Nova", { exact: true }).first().waitFor();
  await expectNavigation(
    [
      "Home",
      "Workforce",
      "My Role",
      "Modules",
      "Work Room",
      "Academy",
      "Intelligence",
    ],
    [
      "Command",
      "Organization",
      "Talent",
      "Stakeholder / Commercial",
      "Operations",
      "Review Room",
      "Portfolio Map",
      "Capital & Investor Relations",
      "Systems",
    ],
  );
  await desktop.goto(`${origin}/company/${companyId}#systems`, {
    waitUntil: "domcontentloaded",
  });
  await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  if (new URL(desktop.url()).hash !== "#home")
    throw new Error(
      "A manually entered hidden surface did not converge to the employee's authorized home.",
    );
  if (
    await desktop
      .getByRole("heading", { name: "Integration Core", exact: true })
      .count()
  )
    throw new Error("A hidden systems workspace rendered for an employee.");
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText("Complete the customer handoff checklist", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByText("Submit the customer handoff for manager review", {
      exact: true,
    })
    .first()
    .waitFor();
  if (
    await desktop
      .getByText("Stabilize the weekly delivery cadence", { exact: true })
      .count()
  )
    throw new Error(
      "An employee can see the manager's work outside self scope.",
    );
  await desktop.getByPlaceholder("Message Nova…").waitFor();

  await switchPrincipal("external");
  await desktop.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "My Role", exact: true })
    .waitFor();
  await expectRenderedText("Implementation Partner");
  await desktop.getByText("Echo", { exact: true }).first().waitFor();
  await expectNavigation(
    ["Home", "My Role", "Modules", "Work Room"],
    [
      "Command",
      "Organization",
      "Talent",
      "Workforce",
      "Stakeholder / Commercial",
      "Operations",
      "Review Room",
      "Academy",
      "Portfolio Map",
      "Capital & Investor Relations",
      "Intelligence",
      "Systems",
    ],
  );
  const externalSelectorProjection = await desktop.evaluate(
    async (activePortfolioId) => {
      const response = await fetch(
        `/api/portfolios/${activePortfolioId}/companies`,
      );
      return response.json();
    },
    portfolioId,
  );
  const externalCompanyProjection = externalSelectorProjection.find(
    (item: { id?: number }) => item.id === companyId,
  );
  if (
    !externalCompanyProjection ||
    externalCompanyProjection.offer !== undefined ||
    externalCompanyProjection.stage !== undefined ||
    externalCompanyProjection.type !== undefined
  )
    throw new Error(
      `The external workspace selector leaked internal company fields: ${JSON.stringify(externalCompanyProjection)}`,
    );
  await desktop.getByRole("link", { name: "Work Room", exact: true }).click();
  await desktop
    .getByText("Deliver the shared implementation artifact", { exact: true })
    .first()
    .waitFor();
  if (
    await desktop
      .getByText("Complete the customer handoff checklist", { exact: true })
      .count()
  )
    throw new Error("An external collaborator can see internal employee work.");
  if (
    await desktop
      .getByText("Stabilize the weekly delivery cadence", { exact: true })
      .count()
  )
    throw new Error("An external collaborator can see internal manager work.");
  await desktop.getByPlaceholder("Message Echo…").waitFor();

  // Prove the complete first-run journey in the rendered product. This uses a
  // principal with no prior state and follows the same portfolio and company
  // controls a new founder receives in production.
  const onboardingSwitch = await desktop.evaluate(async () => {
    const response = await fetch("/api/__fixture/principal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "onboarding" }),
    });
    return response.status;
  });
  if (onboardingSwitch !== 200)
    throw new Error(
      `New-founder fixture principal did not resolve: ${onboardingSwitch}`,
    );
  await desktop.goto(`${origin}/portfolios`, { waitUntil: "domcontentloaded" });
  await desktop
    .getByRole("heading", { name: "Your Portfolios", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", { name: "Create your first portfolio", exact: true })
    .waitFor();
  await desktop
    .getByRole("button", { name: "Create portfolio", exact: true })
    .first()
    .click();
  const createPortfolioDialog = desktop.getByRole("dialog", {
    name: "Create portfolio",
    exact: true,
  });
  await createPortfolioDialog
    .getByLabel("Portfolio name", { exact: true })
    .fill("New Founder Portfolio");
  await createPortfolioDialog
    .getByLabel(/Description/)
    .fill("First-run browser acceptance portfolio");
  await createPortfolioDialog
    .getByRole("button", { name: "Create portfolio", exact: true })
    .click();
  const newPortfolioLink = desktop.getByRole("link", {
    name: /New Founder Portfolio/,
  });
  await newPortfolioLink.waitFor();
  await newPortfolioLink.click();
  await desktop
    .getByRole("heading", { name: "New Founder Portfolio", exact: true })
    .waitFor();
  await desktop
    .getByRole("link", { name: "Add organization", exact: true })
    .first()
    .click();
  await desktop.getByLabel("Step 2 of 6: Company", { exact: true }).waitFor();
  await desktop
    .getByLabel("Company Name", { exact: true })
    .fill("New Founder Company");
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop.getByText("Pre-revenue", { exact: true }).click();
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop.getByLabel("Industry", { exact: true }).fill("Software");
  await desktop.getByText("SaaS", { exact: true }).click();
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop
    .getByLabel("Executive Assistant name", { exact: true })
    .fill("Nova Prime");
  await desktop
    .getByLabel("Founder vision", { exact: true })
    .fill(
      "Build a durable company whose authority and evidence remain clear as it grows.",
    );
  await desktop
    .getByLabel("Values and standards", { exact: true })
    .fill("Clarity, responsibility, and durable customer value.");
  await desktop
    .getByLabel("Decision style", { exact: true })
    .fill(
      "Lead with the recommendation, evidence, risks, and reversible next step.",
    );
  await desktop
    .getByLabel("Working style", { exact: true })
    .fill("Daily brief, explicit decisions, minimal interruption.");
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop
    .getByPlaceholder(/10x revenue/)
    .fill(
      "Validate the first customer outcome and establish a weekly operating cadence.",
    );
  await desktop
    .getByRole("button", { name: "Open command center", exact: true })
    .click();
  await desktop.waitForURL(/\/company\/\d+/);
  await desktop.getByRole("heading", { name: "Home", exact: true }).waitFor();
  await desktop
    .getByRole("button", { name: "Rename Nova Prime", exact: true })
    .waitFor();
  const firstRunState = await desktop.evaluate(async () => {
    const companyId = window.location.pathname.match(/\/company\/(\d+)/)?.[1];
    const [portfolios, context] = await Promise.all([
      fetch("/api/portfolios").then((response) => response.json()),
      fetch(`/api/eos/companies/${companyId}/context`).then((response) =>
        response.json(),
      ),
    ]);
    return { portfolios, context };
  });
  if (
    firstRunState.portfolios.length !== 1 ||
    firstRunState.portfolios[0].name !== "New Founder Portfolio"
  )
    throw new Error(
      `First-run portfolio creation was not durable: ${JSON.stringify(firstRunState.portfolios)}`,
    );
  if (
    firstRunState.context.company?.name !== "New Founder Company" ||
    firstRunState.context.principalContext?.role !== "founder" ||
    firstRunState.context.principalContext?.communicationAgent !== "Nova Prime"
  )
    throw new Error(
      `First-run organization context was incomplete: ${JSON.stringify(firstRunState.context)}`,
    );
  await desktop.goto(`${origin}${new URL(desktop.url()).pathname}#command`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "Command", exact: true })
    .waitFor();
  await desktop
    .getByLabel("Objective title", { exact: true })
    .fill("Prove repeatable customer value");
  await desktop
    .getByLabel("Objective statement", { exact: true })
    .fill("Complete three evidence-backed delivery cycles");
  await desktop
    .getByRole("button", { name: "Record proposed objective", exact: true })
    .click();
  await desktop
    .getByText("Prove repeatable customer value", { exact: true })
    .waitFor();
  await desktop
    .locator("#command-objectives")
    .getByRole("button", { name: "active", exact: true })
    .click();
  await desktop
    .locator("#command-objectives")
    .getByText("active", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByLabel("Metric title", { exact: true })
    .fill("Accepted delivery cycles");
  await desktop.getByLabel("Metric target value", { exact: true }).fill("3");
  await desktop.getByLabel("Metric unit", { exact: true }).fill("cycles");
  await desktop
    .getByRole("button", { name: "Record metric target", exact: true })
    .click();
  await desktop
    .getByText("Accepted delivery cycles", { exact: true })
    .waitFor();
  await desktop
    .getByLabel("Risk title", { exact: true })
    .fill("Single-seat delivery dependency");
  await desktop
    .getByLabel("Risk description", { exact: true })
    .fill("One unavailable seat can stop the delivery cycle");
  await desktop
    .getByRole("button", { name: "Record risk", exact: true })
    .click();
  await desktop
    .getByText("Single-seat delivery dependency", { exact: true })
    .waitFor();

  await desktop.goto(`${origin}${new URL(desktop.url()).pathname}#commercial`, {
    waitUntil: "domcontentloaded",
  });
  await desktop
    .getByRole("heading", { name: "Stakeholder / Commercial", exact: true })
    .waitFor();
  await desktop
    .getByRole("heading", {
      name: "Company-to-company shared services",
      exact: true,
    })
    .waitFor();
  await desktop
    .getByLabel("Party name", { exact: true })
    .fill("Acceptance Customer");
  await desktop
    .getByLabel("Stable identity reference", { exact: true })
    .fill("browser:acceptance-customer");
  await desktop
    .getByRole("button", { name: "Record canonical party", exact: true })
    .click();
  await desktop
    .locator("#commercial-parties")
    .getByText("Acceptance Customer", { exact: true })
    .waitFor();
  await desktop
    .locator("#commercial-parties")
    .getByRole("button", { name: "active", exact: true })
    .click();
  await desktop
    .locator("#commercial-parties")
    .getByText("active", { exact: true })
    .first()
    .waitFor();
  await desktop
    .getByLabel("Relationship title", { exact: true })
    .fill("Acceptance prospect");
  await desktop
    .getByLabel("Need or constraint", { exact: true })
    .fill("Needs evidence before commitment");
  await desktop
    .getByRole("button", { name: "Add relationship context", exact: true })
    .click();
  await desktop
    .locator("#commercial-relationships")
    .getByText("Acceptance prospect", { exact: true })
    .waitFor();
  await desktop
    .getByLabel("Offer name", { exact: true })
    .fill("Acceptance Sprint");
  await desktop
    .getByLabel("Problem or need", { exact: true })
    .fill("Unvalidated operating assumptions");
  await desktop
    .getByLabel("Promise or outcome", { exact: true })
    .fill("Evidence-backed commercial decision");
  await desktop
    .getByRole("button", { name: "Record offer thesis", exact: true })
    .click();
  await desktop
    .locator("#commercial-offers")
    .getByText("Acceptance Sprint", { exact: true })
    .waitFor();
  await desktop
    .getByLabel("Opportunity title", { exact: true })
    .fill("Acceptance Customer sprint");
  await desktop.getByLabel("Opportunity value", { exact: true }).fill("12000");
  await desktop
    .getByLabel("Opportunity probability", { exact: true })
    .fill("60");
  await desktop
    .getByLabel("Next commercial action", { exact: true })
    .fill("Run diagnostic");
  await desktop
    .getByRole("button", { name: "Record opportunity", exact: true })
    .click();
  await desktop
    .locator("#commercial-cases")
    .getByText("Acceptance Customer sprint", { exact: true })
    .waitFor();
  await desktop
    .getByLabel("Value flow title", { exact: true })
    .fill("Acceptance proposal");
  await desktop
    .getByLabel("Agreement reference", { exact: true })
    .fill("draft:browser-acceptance-proposal");
  await desktop
    .getByRole("button", { name: "Record governed value flow", exact: true })
    .click();
  await desktop
    .locator("#commercial-flows")
    .getByText("Acceptance proposal", { exact: true })
    .waitFor();
  const commercialGraphState = await desktop.evaluate(async () => {
    const activeCompanyId =
      window.location.pathname.match(/\/company\/(\d+)/)?.[1];
    return fetch(`/api/eos/companies/${activeCompanyId}/commercial-state`).then(
      (response) => response.json(),
    );
  });
  if (
    !commercialGraphState.stakeholders?.some(
      (item: any) =>
        item.name === "Acceptance Customer" && item.state === "active",
    )
  )
    throw new Error(
      `Canonical stakeholder browser flow did not persist: ${JSON.stringify(commercialGraphState)}`,
    );
  if (
    !commercialGraphState.relationships?.some(
      (item: any) => item.title === "Acceptance prospect",
    )
  )
    throw new Error("Relationship context browser flow did not persist.");
  if (
    !commercialGraphState.offers?.some(
      (item: any) => item.name === "Acceptance Sprint",
    )
  )
    throw new Error("Offer browser flow did not persist.");
  if (
    !commercialGraphState.cases?.some(
      (item: any) => item.title === "Acceptance Customer sprint",
    )
  )
    throw new Error("Opportunity browser flow did not persist.");
  if (
    !commercialGraphState.valueFlows?.some(
      (item: any) => item.title === "Acceptance proposal",
    )
  )
    throw new Error("Value-flow browser flow did not persist.");

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobile = await mobileContext.newPage();
  const assertCompactHeaderAction = async (
    label: string,
    headingName: string,
  ) => {
    const action = mobile
      .getByRole("button", { name: label, exact: true })
      .or(mobile.getByRole("link", { name: label, exact: true }))
      .first();
    const [actionBox, headingBox] = await Promise.all([
      action.boundingBox(),
      mobile
        .getByRole("heading", { name: headingName, exact: true })
        .boundingBox(),
    ]);
    if (
      !actionBox ||
      actionBox.width > 48 ||
      actionBox.height > 48 ||
      Math.abs(actionBox.width - actionBox.height) > 2
    )
      throw new Error(`${label} is not a compact square header action.`);
    if (!headingBox || actionBox.x <= headingBox.x)
      throw new Error(
        `${label} is not positioned to the right of the page title.`,
      );
  };
  await mobile.goto(`${origin}/portfolios`, { waitUntil: "domcontentloaded" });
  await mobile
    .getByRole("heading", { name: "Your Portfolios", exact: true })
    .waitFor();
  await mobile
    .getByText("Create a new portfolio or enter an existing organization.", {
      exact: true,
    })
    .waitFor();
  if (
    await mobile
      .getByRole("button", { name: "Open navigation", exact: true })
      .count()
  )
    throw new Error(
      "Portfolio selection still exposes organization operating navigation.",
    );
  if (
    await mobile
      .getByRole("navigation", { name: "EOS primary navigation" })
      .count()
  )
    throw new Error(
      "Portfolio selection still renders a non-functional operating rail.",
    );
  await assertCompactHeaderAction("Create portfolio", "Your Portfolios");
  await mobile.goto(`${origin}/portfolios/${portfolioId}`, {
    waitUntil: "domcontentloaded",
  });
  await mobile
    .getByRole("heading", { name: portfolioName, exact: true })
    .waitFor();
  await mobile.getByText("Organizations", { exact: true }).first().waitFor();
  if (await mobile.getByText("Operating contexts", { exact: true }).count())
    throw new Error(
      "The obsolete operating-context metric is still shown beside Organizations.",
    );
  await assertCompactHeaderAction("Add organization", portfolioName);
  await mobile.goto(`${origin}/company-setup?portfolioId=${portfolioId}`, {
    waitUntil: "domcontentloaded",
  });
  await mobile
    .getByRole("heading", {
      name: "Build the operating foundation",
      exact: true,
    })
    .waitFor();
  await mobile.getByLabel("Step 2 of 6: Company", { exact: true }).waitFor();
  if (
    await mobile
      .getByRole("button", { name: "Open navigation", exact: true })
      .count()
  )
    throw new Error(
      "Company setup exposes operating navigation before an organization exists.",
    );
  const setupOverflow = await mobile.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (setupOverflow)
    throw new Error("Mobile company setup has horizontal overflow.");
  await mobile.getByRole("button", { name: "Back", exact: true }).click();
  await mobile.getByLabel("Step 1 of 6: Portfolio", { exact: true }).waitFor();
  await mobile
    .getByText(portfolioName, { exact: true })
    .locator("xpath=ancestor::button[1]")
    .click();
  await mobile.getByLabel("Step 2 of 6: Company", { exact: true }).waitFor();
  await mobile.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await mobile.getByRole("heading", { name: "My Role", exact: true }).waitFor();
  await assertCompactHeaderAction("Refresh workspace", "My Role");
  const mobileOverflow = await mobile.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (mobileOverflow)
    throw new Error("Mobile workspace has horizontal overflow.");
  await mobile.goto(`${origin}/settings?companyId=${companyId}`, {
    waitUntil: "domcontentloaded",
  });
  await mobile
    .getByRole("heading", { name: "Settings", exact: true })
    .waitFor();
  await mobile.getByRole("tab", { name: "Billing", exact: true }).click();
  await mobile
    .getByText("Billing is not available in this environment", { exact: true })
    .waitFor();
  if (
    (await mobile
      .getByRole("tab", { name: "Billing", exact: true })
      .getAttribute("data-state")) !== "active"
  )
    throw new Error("Mobile Billing tab did not become active.");
  if (
    (await mobile
      .getByRole("tab", { name: "Profile", exact: true })
      .getAttribute("data-state")) !== "inactive"
  )
    throw new Error(
      "Mobile Profile tab remained active after selecting Billing.",
    );
  const profileTabBackground = await mobile
    .getByRole("tab", { name: "Profile", exact: true })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  const billingTabBackground = await mobile
    .getByRole("tab", { name: "Billing", exact: true })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  if (profileTabBackground === billingTabBackground)
    throw new Error(
      "Mobile inactive Profile tab still looks active after selecting Billing.",
    );
  if (process.env.EOS_CAPTURE_VISUALS === "true")
    await mobile.screenshot({
      path: ".tmp/eos-settings-mobile.png",
      fullPage: true,
    });
  if (
    await mobile.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
  )
    throw new Error("Mobile settings has horizontal overflow.");
  await mobile.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await mobile.getByRole("heading", { name: "My Role", exact: true }).waitFor();
  const fab = mobile.getByRole("button", { name: "Open communication" });
  const beforeDrag = await fab.boundingBox();
  if (!beforeDrag) throw new Error("Communication FAB did not render.");
  await mobile.mouse.move(
    beforeDrag.x + beforeDrag.width / 2,
    beforeDrag.y + beforeDrag.height / 2,
  );
  await mobile.mouse.down();
  await mobile.mouse.move(
    beforeDrag.x + beforeDrag.width / 2 + 90,
    beforeDrag.y + beforeDrag.height / 2 - 90,
    { steps: 8 },
  );
  await mobile.mouse.up();
  const afterDrag = await fab.boundingBox();
  if (
    !afterDrag ||
    (Math.abs(afterDrag.x - beforeDrag.x) < 20 &&
      Math.abs(afterDrag.y - beforeDrag.y) < 20)
  )
    throw new Error("Communication FAB did not move after a pointer drag.");
  await fab.click();
  const drawer = mobile.locator("#mobile-communication-drawer aside");
  await drawer.waitFor();
  const box = await drawer.boundingBox();
  if (!box || Math.abs(box.width - 390) > 2)
    throw new Error(
      `Mobile communication drawer is ${box?.width ?? 0}px instead of full width.`,
    );
  await drawer.getByRole("button", { name: "Close communication" }).click();
  await mobile.goto(`${origin}/company/${companyId}#intelligence`, {
    waitUntil: "domcontentloaded",
  });
  await mobile
    .getByRole("heading", { name: "Intelligence", exact: true })
    .waitFor();
  await mobile.getByRole("button", { name: /Open .* conversation/ }).click();
  await mobile.locator("#mobile-communication-drawer aside").waitFor();
  await mobile
    .locator("#mobile-communication-drawer aside")
    .getByRole("button", { name: "Close communication", exact: true })
    .click();
  const mobileRateLimitReset = await mobile.request.post(
    `${apiOrigin}/__fixture/reset-rate-limits`,
  );
  if (!mobileRateLimitReset.ok())
    throw new Error(
      "Browser fixture rate limits could not be reset before the mobile role journey.",
    );
  const mobileEmployeeSwitch = await mobile.evaluate(async () => {
    const switched = await fetch("/api/__fixture/principal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "employee" }),
    });
    const context = await fetch(
      `/api/eos/companies/${window.location.pathname.match(/\/company\/(\d+)/)?.[1]}/context`,
    );
    const body = await context.json();
    return {
      switchStatus: switched.status,
      contextStatus: context.status,
      role: body?.principalContext?.role,
    };
  });
  if (
    mobileEmployeeSwitch.switchStatus !== 200 ||
    mobileEmployeeSwitch.contextStatus !== 200 ||
    mobileEmployeeSwitch.role !== "individual_contributor"
  )
    throw new Error(
      `Mobile employee principal did not resolve: ${JSON.stringify(mobileEmployeeSwitch)}`,
    );
  await mobile.reload({ waitUntil: "domcontentloaded" });
  await mobile.goto(`${origin}/company/${companyId}#my-role`, {
    waitUntil: "domcontentloaded",
  });
  await mobile.getByRole("heading", { name: "My Role", exact: true }).waitFor();
  await mobile
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const mobileEmployeeNavigation = mobile.getByRole("navigation", {
    name: "EOS primary navigation",
  });
  const mobileEmployeeNavigationText =
    await mobileEmployeeNavigation.innerText();
  for (const visible of [
    "Home",
    "Workforce",
    "My Role",
    "Modules",
    "Work Room",
    "Academy",
    "Intelligence",
  ])
    if (!mobileEmployeeNavigationText.includes(visible))
      throw new Error(
        `${visible} is absent from the mobile employee navigation.`,
      );
  for (const hidden of [
    "Command",
    "Organization",
    "Operations",
    "Review Room",
    "Systems",
    "Capital & Investor Relations",
  ])
    if (mobileEmployeeNavigationText.includes(hidden))
      throw new Error(
        `${hidden} is visible in the mobile employee navigation.`,
      );
  await mobileEmployeeNavigation
    .getByRole("link", { name: "Work Room", exact: true })
    .click();
  await mobile
    .getByRole("heading", { name: "Work Room", exact: true })
    .waitFor();
  await mobile
    .getByText("Complete the customer handoff checklist", { exact: true })
    .first()
    .waitFor();
  if (
    await mobile
      .getByText("Stabilize the weekly delivery cadence", { exact: true })
      .count()
  )
    throw new Error("The mobile employee can see upward manager work.");
  await mobile
    .getByRole("button", { name: "Open communication", exact: true })
    .click();
  await mobile
    .locator("#mobile-communication-drawer aside")
    .getByPlaceholder("Message Nova…")
    .waitFor();
  if (
    await mobile.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
  )
    throw new Error("The mobile employee workspace has horizontal overflow.");
  const empyreanCompile = await desktop.evaluate(async () => {
    const companyId = window.location.pathname.match(/\/company\/(\d+)/)?.[1];
    if (!companyId)
      return { renameStatus: 0, compileStatus: 0, companyId: "" };
    const renamed = await fetch("/api/companies/" + companyId, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Empyrean Creative" }),
    });
    const compiled = await fetch(
      "/api/eos/companies/" +
        companyId +
        "/company-packages/empyrean-studios-reference/compile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirmOrganizationKey: "ORG-EMPYREAN-STUDIOS",
        }),
      },
    );
    return {
      renameStatus: renamed.status,
      compileStatus: compiled.status,
      body: await compiled.json(),
      companyId,
    };
  });
  if (
    empyreanCompile.renameStatus !== 200 ||
    empyreanCompile.compileStatus !== 201 ||
    empyreanCompile.body?.report?.activationState !== "blocked"
  )
    throw new Error(
      "Empyrean reference instance did not compile in the rendered founder journey: " +
        JSON.stringify(empyreanCompile),
    );
  await desktop.goto(
    origin + "/company/" + empyreanCompile.companyId + "#organization",
    { waitUntil: "domcontentloaded" },
  );
  await desktop.reload({ waitUntil: "domcontentloaded" });
  await desktop
    .getByText("Empyrean Studios reference instance", { exact: true })
    .waitFor();
  await desktop
    .getByRole("button", {
      name: "Canonical representation complete",
      exact: true,
    })
    .waitFor();
  await desktop.getByRole("link", { name: "Command", exact: true }).click();
  await desktop
    .getByText("Prove one Recovery System lifecycle", { exact: true })
    .waitFor();
  await desktop.goto(
    origin + "/company/" + empyreanCompile.companyId + "#commercial",
    { waitUntil: "domcontentloaded" },
  );
  await desktop
    .locator("#commercial-offers")
    .getByText("Recovery System", { exact: true })
    .waitFor();
  await desktop.goto(
    origin + "/company/" + empyreanCompile.companyId + "#systems",
    { waitUntil: "domcontentloaded" },
  );
  const canonicalInstruments = desktop.getByTestId("canonical-instrument-control-center");
  await canonicalInstruments.getByText("Canonical instrument workspace", { exact: true }).waitFor();
  for (const instrument of ["Docs", "Drive / Files", "Sheets", "Slides", "Conference Rooms", "Ads", "Reputation"])
    await canonicalInstruments.getByRole("button", { name: new RegExp(`^${instrument.replace("/", "\\/")}`) }).waitFor();
  const browserInstrumentTitle = `Browser operating brief ${Date.now()}`;
  await canonicalInstruments.getByLabel("Title", { exact: true }).fill(browserInstrumentTitle);
  await canonicalInstruments.getByLabel("Summary", { exact: true }).fill("A synthetic governed brief created through the guided canonical instrument workspace.");
  await canonicalInstruments.getByText("Activation-ready structure.", { exact: false }).waitFor();
  await canonicalInstruments.getByRole("button", { name: "Create draft object", exact: true }).click();
  await canonicalInstruments.getByText(browserInstrumentTitle, { exact: true }).first().waitFor();
  await canonicalInstruments.getByRole("button", { name: /draft.*active/i }).click();
  await canonicalInstruments.getByText("active", { exact: true }).first().waitFor();
  await canonicalInstruments.getByLabel("Object Evidence", { exact: true }).waitFor();
  const downloadPromise = desktop.waitForEvent("download");
  await canonicalInstruments.getByRole("button", { name: "Export", exact: true }).click();
  const instrumentDownload = await downloadPromise;
  if (instrumentDownload.suggestedFilename() !== "eos-docs-bundle.json") throw new Error("The canonical instrument export did not use the bounded portable filename.");
  const portableBundle = await desktop.evaluate(async () => {
    const companyId = window.location.pathname.match(/\/company\/(\d+)/)?.[1];
    const response = await fetch(`/api/eos/companies/${companyId}/instrument-export?instrumentKey=docs`);
    if (!response.ok) throw new Error(`Instrument export failed with ${response.status}.`);
    return response.json();
  });
  await canonicalInstruments.getByLabel("Import instrument bundle", { exact: true }).setInputFiles({ name: "eos-docs-bundle.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(portableBundle)) });
  await canonicalInstruments.getByText(browserInstrumentTitle, { exact: true }).nth(1).waitFor();
  await desktop
    .getByText("GoHighLevel → EOS reference binding", { exact: true })
    .first()
    .waitFor();
  await desktop.getByText("EOS Native Signing", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Library", exact: true }).click();
  await desktop.getByText("Governed jurisdiction packs", { exact: true }).waitFor();
  await desktop.getByText("counsel attributed", { exact: true }).waitFor();
  await desktop.getByText("Portfolio contract proposals", { exact: true }).waitFor();
  await desktop.getByText("company-local authority", { exact: true }).waitFor();
  await desktop.getByText("Reusable clause", { exact: true }).waitFor();
  await desktop.getByText("Contract template", { exact: true }).waitFor();
  await desktop.getByText("Generate an agreement", { exact: true }).waitFor();
  const browserTemplateKey = `browser-template-${Date.now()}`;
  const browserClientName = `Browser Contract Client ${Date.now()}`;
  await desktop.getByPlaceholder("Legal name", { exact: true }).fill(browserClientName + " LLC");
  await desktop.getByPlaceholder("Display name", { exact: true }).fill(browserClientName);
  await desktop.getByPlaceholder("Primary signer", { exact: true }).fill("Browser Contract Signer");
  await desktop.getByPlaceholder("signer@example.com", { exact: true }).fill("browser-contract-signer@example.test");
  await desktop.getByRole("button", { name: "Add counterparty", exact: true }).click();
  await desktop.getByText("Counterparty added", { exact: true }).waitFor();
  await desktop.getByPlaceholder("template-key", { exact: true }).fill(browserTemplateKey);
  await desktop.getByPlaceholder("Template name", { exact: true }).fill("Browser governed agreement");
  await desktop.getByPlaceholder("Title template", { exact: true }).fill("Browser agreement for {{client-name}}");
  await desktop.getByPlaceholder("Agreement body", { exact: true }).fill("This governed browser agreement becomes effective on {{effective-date}} and records an exact reusable template snapshot.");
  await desktop.getByRole("button", { name: "Create template draft", exact: true }).click();
  await desktop.getByText("Template draft created", { exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Approve", exact: true }).click();
  await desktop.getByText("Template version approved", { exact: true }).waitFor();
  const generationPanel = desktop.getByText("Generate an agreement", { exact: true }).locator("xpath=ancestor::section[1]");
  await generationPanel.getByRole("combobox").nth(0).selectOption({ label: "Browser governed agreement · 1.0" });
  await generationPanel.getByRole("combobox").nth(1).selectOption({ label: browserClientName });
  await generationPanel.getByRole("combobox").nth(2).selectOption({ index: 1 });
  await generationPanel.getByLabel("client name *", { exact: true }).fill(browserClientName + " LLC");
  await generationPanel.getByLabel("effective date *", { exact: true }).fill("2026-09-01");
  await generationPanel.getByRole("button", { name: "Generate immutable PDF", exact: true }).click();
  await desktop.getByText("Governed agreement generated", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Documents", exact: true }).click();
  await desktop.getByText("Compose envelope · Browser agreement for " + browserClientName + " LLC", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Operations", exact: true }).click();
  await desktop.getByText("Create signed lifecycle webhook", { exact: true }).waitFor();
  await desktop.getByText("Recovery and replay", { exact: true }).waitFor();
  const replacementScenario = await desktop.evaluate(async ({ activeCompanyId, templateKey, generatedTitle, clientName }) => {
    const root = `/api/eos/companies/${activeCompanyId}/native-esign`;
    const libraryResponse = await fetch(`${root}/library`);
    const library = await libraryResponse.json();
    if (!libraryResponse.ok) throw new Error(`library read failed: ${libraryResponse.status} ${JSON.stringify(library)}`);
    const documentsResponse = await fetch(`${root}/documents`);
    const documents = await documentsResponse.json();
    if (!documentsResponse.ok) throw new Error(`document read failed: ${documentsResponse.status} ${JSON.stringify(documents)}`);
    let template: any = null;
    for (const item of library.templates) if (item.templateKey === templateKey) template = item;
    let version: any = null;
    for (const item of library.templateVersions) if (item.templateId === template?.id && item.versionLabel === "1.0") version = item;
    let document: any = null;
    for (const item of documents) if (item.title === generatedTitle) document = item;
    if (!template || !version || !document) throw new Error("Generated browser contract lineage was not resolvable.");
    const sourceEnvelopeResponse = await fetch(`${root}/envelopes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentVersionId: document.id, subject: "Browser replacement source agreement", message: "Review this version before governed replacement.", routingMode: "sequential", assuranceMode: "link", expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(), recipients: [{ roleKey: "counterparty", routingOrder: 1, signerName: "Browser Contract Signer", signerEmail: "browser-contract-signer@example.test" }] }) });
    const sourceEnvelope = await sourceEnvelopeResponse.json();
    if (!sourceEnvelopeResponse.ok) throw new Error(`source envelope creation failed: ${sourceEnvelopeResponse.status} ${JSON.stringify(sourceEnvelope)}`);
    const issueResponse = await fetch(`${root}/envelopes/${sourceEnvelope.id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const issued = await issueResponse.json();
    if (!issueResponse.ok) throw new Error(`source envelope issue failed: ${issueResponse.status} ${JSON.stringify(issued)}`);
    const sourceToken = new URL(issued.recipients[0].signingUrl).pathname.split("/").at(-1);
    const negotiationResponse = await fetch(`/api/eos/native-esign/public/${sourceToken}/negotiations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "Browser replacement review", body: "Please add the explicit replacement-review sentence.", requestedChanges: ["Add an explicit replacement-review sentence."] }) });
    const negotiation = await negotiationResponse.json();
    if (!negotiationResponse.ok) throw new Error(`negotiation creation failed: ${negotiationResponse.status} ${JSON.stringify(negotiation)}`);
    const revisedVersionResponse = await fetch(`${root}/templates/${template.id}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      versionLabel: "1.1", titleTemplate: version.titleTemplate,
      bodyTemplate: version.bodyTemplate + "\n\nThis replacement was reviewed through the exact browser comparison workflow.",
      variables: version.variableSchema, recipients: version.recipientSchema, clauseVersionIds: [],
    }) });
    const revisedVersion = await revisedVersionResponse.json();
    if (!revisedVersionResponse.ok) throw new Error(`template revision failed: ${revisedVersionResponse.status} ${JSON.stringify(revisedVersion)}`);
    const approvalResponse = await fetch(`${root}/template-versions/${revisedVersion.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Founder-approved browser comparison qualification revision." }) });
    const approval = await approvalResponse.json();
    if (!approvalResponse.ok) throw new Error(`template revision approval failed: ${approvalResponse.status} ${JSON.stringify(approval)}`);
    const revisionResponse = await fetch(`${root}/documents/${document.id}/generated-revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateVersionId: revisedVersion.id, values: { "client-name": clientName + " LLC", "effective-date": "2026-09-01" }, documentVersion: "1.1-browser-replacement", revisionSummary: "Added the explicit replacement-review sentence after signer request.", negotiationId: negotiation.negotiation.id }) });
    const revision = await revisionResponse.json();
    if (!revisionResponse.ok) throw new Error(`generated replacement revision failed: ${revisionResponse.status} ${JSON.stringify(revision)}`);
    const replacementResponse = await fetch(`${root}/envelopes/${sourceEnvelope.id}/replacement`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentVersionId: revision.id, negotiationId: negotiation.negotiation.id, subject: "Browser exact-comparison replacement agreement", expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString() }) });
    const replacement = await replacementResponse.json();
    if (!replacementResponse.ok) throw new Error(`replacement envelope creation failed: ${replacementResponse.status} ${JSON.stringify(replacement)}`);
    return { envelopeId: replacement.envelope.id as string, subject: replacement.envelope.subject as string, comparisonSha256: revision.comparison.comparisonSha256 as string };
  }, { activeCompanyId: empyreanCompile.companyId, templateKey: browserTemplateKey, generatedTitle: "Browser agreement for " + browserClientName + " LLC", clientName: browserClientName });
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByText("EOS Native Signing", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByPlaceholder("Search envelope subject or message", { exact: true }).fill(replacementScenario.subject);
  await desktop.getByText(replacementScenario.subject, { exact: true }).first().click();
  await desktop.getByRole("heading", { name: "Replacement agreement comparison", exact: true }).waitFor();
  await desktop.getByText("Exact generated-text diff", { exact: true }).waitFor();
  await desktop.getByText("Review exact line changes", { exact: true }).waitFor();
  await desktop.getByText("This replacement was reviewed through the exact browser comparison workflow.", { exact: false }).waitFor();
  const replacementIssueButton = desktop.getByRole("button", { name: "Issue envelope", exact: true });
  if (!(await replacementIssueButton.isDisabled())) throw new Error("Replacement issuance was not blocked before exact-comparison acknowledgement.");
  const operatorComparisonLabel = desktop.getByText("Approve this exact replacement comparison", { exact: true }).locator("xpath=ancestor::label[1]");
  await operatorComparisonLabel.getByRole("checkbox").check();
  const replacementIssueResponsePromise = desktop.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith(`/native-esign/envelopes/${replacementScenario.envelopeId}/issue`));
  await replacementIssueButton.click();
  const replacementIssueResponse = await replacementIssueResponsePromise;
  if (!replacementIssueResponse.ok()) throw new Error(`Browser replacement issue failed: ${replacementIssueResponse.status()} ${await replacementIssueResponse.text()}`);
  const replacementIssue = await replacementIssueResponse.json();
  await desktop.getByText("Envelope issued", { exact: true }).waitFor();
  await desktop.goto(replacementIssue.recipients[0].signingUrl, { waitUntil: "domcontentloaded" });
  await desktop.getByRole("heading", { name: "Replacement agreement comparison", exact: true }).waitFor();
  await desktop.getByText("This replacement was reviewed through the exact browser comparison workflow.", { exact: false }).waitFor();
  const replacementConsentButton = desktop.getByRole("button", { name: "Accept and continue", exact: true });
  const replacementConsentChecks = desktop.getByRole("checkbox");
  await replacementConsentChecks.nth(0).check();
  await replacementConsentChecks.nth(1).check();
  if (!(await replacementConsentButton.isDisabled())) throw new Error("Replacement consent was not blocked before signer comparison acknowledgement.");
  await desktop.getByText("I reviewed this replacement comparison.", { exact: true }).locator("xpath=ancestor::label[1]").getByRole("checkbox").check();
  await replacementConsentButton.click();
  await desktop.getByRole("heading", { name: "Sign the document", exact: true }).waitFor();
  const placementDisclosure = desktop.getByText("What EOS will place in the PDF", { exact: true }).locator("xpath=..");
  await placementDisclosure.waitFor();
  const placementDisclosureText = await placementDisclosure.textContent();
  if (!placementDisclosureText || !/Page \d+/.test(placementDisclosureText) || !placementDisclosureText.includes("your selected signature"))
    throw new Error(`Signer placement disclosure is incomplete: ${placementDisclosureText || "empty"}`);
  await desktop.getByText("I intend to sign this document", { exact: false }).locator("xpath=ancestor::label[1]").getByRole("checkbox").check();
  await desktop.getByRole("button", { name: "Sign document", exact: true }).click();
  await desktop.getByRole("heading", { name: "Document signed", exact: true }).waitFor({ timeout: 90_000 });
  const obligationScenario = await desktop.evaluate(async ({ activeCompanyId, envelopeId }) => {
    const root = `/api/eos/companies/${activeCompanyId}`;
    const verificationResponse = await fetch(`${root}/native-esign/envelopes/${envelopeId}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Browser qualification before contract Evidence promotion." }) });
    const verification = await verificationResponse.json();
    if (!verificationResponse.ok) throw new Error(`verification failed: ${verificationResponse.status} ${JSON.stringify(verification)}`);
    let detailResponse = await fetch(`${root}/native-esign/envelopes/${envelopeId}`);
    let detail = await detailResponse.json();
    if (!detailResponse.ok) throw new Error(`envelope detail failed: ${detailResponse.status} ${JSON.stringify(detail)}`);
    if (!detail.envelope.workPacketId) throw new Error("Browser agreement did not retain its governed Work Packet.");
    if (detail.custody?.policy) throw new Error("Browser contract unexpectedly inherited retention authority before explicit activation.");
    const policyBody: Record<string, unknown> = { name: "Browser contract evidence retention", retentionDays: 365, backupRequired: true };
    if (detail.custody?.policy?.version) policyBody.version = detail.custody.policy.version;
    const policyResponse = await fetch(`${root}/native-esign/custody/retention-policy`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policyBody) });
    const policy = await policyResponse.json();
    if (!policyResponse.ok) throw new Error(`retention policy failed: ${policyResponse.status} ${JSON.stringify(policy)}`);
    const custodyResponse = await fetch(`${root}/native-esign/envelopes/${envelopeId}/custody/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const custody = await custodyResponse.json();
    if (!custodyResponse.ok) throw new Error(`custody verification failed: ${custodyResponse.status} ${JSON.stringify(custody)}`);
    const evidenceResponse = await fetch(`${root}/native-esign/envelopes/${envelopeId}/promote-evidence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workPacketId: detail.envelope.workPacketId, supportedClaimSummary: "The browser-qualified parties executed the governed replacement agreement.", verifierMethod: "EOS browser acceptance integrity and custody verification." }) });
    const promotedEvidence = await evidenceResponse.json();
    if (!evidenceResponse.ok) throw new Error(`Evidence promotion failed: ${evidenceResponse.status} ${JSON.stringify(promotedEvidence)}`);
    const organizationResponse = await fetch(`${root}/organization-runtime`);
    const organization = await organizationResponse.json();
    if (!organizationResponse.ok) throw new Error(`organization read failed: ${organizationResponse.status} ${JSON.stringify(organization)}`);
    const ownerSeatId = organization.activeSeatId;
    if (!ownerSeatId) throw new Error("Browser organization has no active accountable seat.");
    const obligationKey = `browser-contract-obligation-${Date.now()}`;
    const obligationResponse = await fetch(`${root}/native-esign/envelopes/${envelopeId}/promote-obligation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      obligationKey,
      title: "Deliver the browser-qualified contract outcome",
      ownerSeatId,
      description: "Deliver the governed outcome and retain separate operational Evidence before closing the obligation.",
      sourceExcerpt: "This replacement was reviewed through the exact browser comparison workflow.",
      dueReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
      classification: "confidential",
    }) });
    const obligation = await obligationResponse.json();
    if (!obligationResponse.ok) throw new Error(`obligation promotion failed: ${obligationResponse.status} ${JSON.stringify(obligation)}`);
    detailResponse = await fetch(`${root}/native-esign/envelopes/${envelopeId}`);
    detail = await detailResponse.json();
    if (!detailResponse.ok) throw new Error(`obligation detail failed: ${detailResponse.status} ${JSON.stringify(detail)}`);
    const promotion = detail.obligationPromotions.find((item: any) => item.obligation?.riskControlKey === obligationKey);
    if (!promotion?.obligation) throw new Error("Promoted browser obligation was not projected back into the envelope.");
    return { envelopeId: detail.envelope.id as string, subject: detail.envelope.subject as string, obligationTitle: promotion.obligation.title as string };
  }, { activeCompanyId: empyreanCompile.companyId, envelopeId: replacementScenario.envelopeId });
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByText("EOS Native Signing", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByPlaceholder("Search envelope subject or message", { exact: true }).fill(obligationScenario.subject);
  await desktop.getByText(obligationScenario.subject, { exact: true }).first().click();
  await desktop.getByText("Contract obligation operations", { exact: true }).waitFor();
  await desktop.getByText(obligationScenario.obligationTitle, { exact: true }).waitFor();
  const obligationOperations = desktop.getByRole("region", { name: "Promoted contract obligations" });
  await obligationOperations.getByPlaceholder("What was reviewed, what the Evidence establishes, and what happens next").fill("Founder reviewed the exact source and assigned a bounded operational assessment with a scheduled follow-up.");
  await obligationOperations.getByRole("button", { name: "Record review", exact: true }).click();
  await desktop.getByText("Obligation review recorded", { exact: true }).waitFor();
  await obligationOperations.getByText("under assessment", { exact: true }).first().waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Contracts", exact: true }).click();
  await desktop.getByText("Contract control center", { exact: true }).waitFor();
  const contractControl = desktop.getByTestId(`contract-control-${obligationScenario.envelopeId}`);
  await contractControl.getByRole("button", { name: "Create control plan", exact: true }).click();
  await contractControl.getByLabel("Human-reviewed schedule notes").fill("Founder confirmed the executed effective date and accountable seat during browser qualification.");
  await contractControl.getByRole("button", { name: "Save governed plan", exact: true }).click();
  await desktop.getByText("Contract control plan recorded", { exact: true }).waitFor();
  await contractControl.getByText("active", { exact: true }).waitFor();
  await contractControl.getByRole("button", { name: "Prepare notice", exact: true }).click();
  await contractControl.getByLabel("Recipient name").fill("Browser Counterparty");
  await contractControl.getByLabel("Recipient email").fill("browser-counterparty@example.test");
  await contractControl.getByLabel("Email subject").fill("Browser-qualified contract administration notice");
  await contractControl.getByLabel("Exact notice text").fill("This exact contract administration notice was prepared through the governed browser workflow. It has not been approved or sent.");
  await contractControl.getByRole("button", { name: "Create notice draft", exact: true }).click();
  await desktop.getByText("Notice draft prepared", { exact: true }).waitFor();
  await contractControl.getByText("Browser-qualified contract administration notice", { exact: true }).waitFor();
  await contractControl.getByText("draft", { exact: true }).waitFor();
  const signerPdf = await PDFDocument.create();
  signerPdf.addPage([612, 792]);
  const signerPdfBase64 = Buffer.from(await signerPdf.save()).toString("base64");
  const browserSignatureFieldId = randomUUID();
  const browserDocumentKey = `browser-signature-${randomUUID()}`;
  const browserSigningUrl = await desktop.evaluate(async ({ activeCompanyId, pdfBase64, fieldId, documentKey }) => {
    const bytes = Uint8Array.from(atob(pdfBase64), (character) => character.charCodeAt(0));
    const fields = [{ id: fieldId, roleKey: "client", type: "signature", page: 1, x: 0.12, y: 0.68, width: 0.5, height: 0.1, label: "Client signature", required: true }];
    const encodedFields = btoa(JSON.stringify(fields)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const documentResponse = await fetch(`/api/eos/companies/${activeCompanyId}/native-esign/documents?documentKey=${encodeURIComponent(documentKey)}&documentVersion=1.0&title=${encodeURIComponent("Browser visual signature agreement")}&sourceReference=${encodeURIComponent("e2e://native-esign/visual-capture")}`, {
      method: "POST", headers: { "Content-Type": "application/pdf", "x-eos-field-schema": encodedFields }, body: bytes,
    });
    const document = await documentResponse.json();
    if (!documentResponse.ok) throw new Error(`document registration failed: ${documentResponse.status} ${JSON.stringify(document)}`);
    const envelopeResponse = await fetch(`/api/eos/companies/${activeCompanyId}/native-esign/envelopes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentVersionId: document.id, subject: "Draw and sign this agreement", message: "Rendered browser qualification.", routingMode: "sequential", expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(), recipients: [{ roleKey: "client", routingOrder: 1, signerName: "Browser Signer", signerEmail: "browser-signer@example.test" }] }),
    });
    const envelope = await envelopeResponse.json();
    if (!envelopeResponse.ok) throw new Error(`envelope creation failed: ${envelopeResponse.status} ${JSON.stringify(envelope)}`);
    const issueResponse = await fetch(`/api/eos/companies/${activeCompanyId}/native-esign/envelopes/${envelope.id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const issued = await issueResponse.json();
    if (!issueResponse.ok) throw new Error(`envelope issue failed: ${issueResponse.status} ${JSON.stringify(issued)}`);
    return issued.recipients[0].signingUrl as string;
  }, { activeCompanyId: empyreanCompile.companyId, pdfBase64: signerPdfBase64, fieldId: browserSignatureFieldId, documentKey: browserDocumentKey });
  await desktop.goto(browserSigningUrl, { waitUntil: "domcontentloaded" });
  await desktop.getByRole("heading", { name: "Draw and sign this agreement", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Request changes", exact: true }).click();
  await desktop.getByPlaceholder("Explain the requested changes", { exact: true }).fill("Please confirm the rendered agreement before I consent.");
  await desktop.getByPlaceholder("One concrete requested change per line", { exact: true }).fill("Confirm the rendered agreement snapshot.");
  await desktop.getByRole("button", { name: "Send request", exact: true }).click();
  await desktop.getByText("Signing is paused while you and the sender resolve this governed discussion.", { exact: true }).waitFor();
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByText("EOS Native Signing", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByText("Draw and sign this agreement", { exact: true }).first().click();
  await desktop.getByText("Agreement negotiation", { exact: true }).waitFor();
  await desktop.getByPlaceholder("Respond to the requested changes", { exact: true }).fill("The immutable rendered snapshot has been reviewed and confirmed.");
  await desktop.getByRole("button", { name: "Record response", exact: true }).click();
  await desktop.getByText("Negotiation response recorded", { exact: true }).waitFor();
  await desktop.getByText("Create governed replacement", { exact: true }).click();
  await desktop.getByRole("button", { name: "Reviewed PDF", exact: true }).waitFor();
  await desktop.getByText("EOS never claims an automated legal redline for an uploaded PDF.", { exact: false }).waitFor();
  await desktop.goto(browserSigningUrl, { waitUntil: "domcontentloaded" });
  await desktop.getByText("The immutable rendered snapshot has been reviewed and confirmed.", { exact: true }).waitFor();
  await desktop.getByPlaceholder("Reply to the sender", { exact: true }).fill("Thank you. I am ready to continue after resolution.");
  await desktop.getByRole("button", { name: "Send reply", exact: true }).click();
  await desktop.getByText("Thank you. I am ready to continue after resolution.", { exact: true }).waitFor();
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByText("Draw and sign this agreement", { exact: true }).first().click();
  await desktop.getByText("Thank you. I am ready to continue after resolution.", { exact: true }).waitFor();
  await desktop.getByPlaceholder("Resolution summary when no document replacement is needed", { exact: true }).fill("The rendered snapshot was confirmed; the signer may continue.");
  await desktop.getByRole("button", { name: "Resolve without replacement", exact: true }).click();
  await desktop.getByText("Negotiation resolved", { exact: true }).waitFor();
  await desktop.goto(browserSigningUrl, { waitUntil: "domcontentloaded" });
  const consentChecks = desktop.getByRole("checkbox");
  await consentChecks.nth(0).check();
  await consentChecks.nth(1).check();
  await desktop.getByRole("button", { name: "Accept and continue", exact: true }).click();
  await desktop.getByRole("button", { name: "Type", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Upload", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Draw", exact: true }).click();
  const signatureCanvas = desktop.getByLabel("Draw signature area", { exact: true });
  const signatureBox = await signatureCanvas.boundingBox();
  if (!signatureBox) throw new Error("Drawn-signature canvas did not produce a rendered box.");
  await desktop.mouse.move(signatureBox.x + 24, signatureBox.y + signatureBox.height - 28);
  await desktop.mouse.down();
  await desktop.mouse.move(signatureBox.x + signatureBox.width * 0.35, signatureBox.y + 32, { steps: 8 });
  await desktop.mouse.move(signatureBox.x + signatureBox.width * 0.72, signatureBox.y + signatureBox.height - 34, { steps: 8 });
  await desktop.mouse.up();
  await desktop.getByRole("checkbox").last().check();
  await desktop.getByRole("button", { name: "Sign document", exact: true }).click();
  await desktop.getByRole("heading", { name: "Document signed", exact: true }).waitFor();
  await desktop.getByText("Evidence verified", { exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Verify signed record", exact: true }).click();
  await desktop.getByText("Evidence verified", { exact: true }).waitFor();
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByText("EOS Native Signing", { exact: true }).waitFor();
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByText("Draw and sign this agreement", { exact: true }).first().waitFor();
  await desktop.getByText("Evidence custody", { exact: true }).waitFor();
  await desktop.getByText("365 days", { exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Verify custody", exact: true }).waitFor();
  await desktop.getByRole("button", { name: "Back up and verify", exact: true }).waitFor();
  await desktop.getByText("Storage loss-and-recovery drill", { exact: true }).click();
  await desktop.getByRole("button", { name: "Run recovery drill", exact: true }).click();
  await desktop.getByText("Storage recovery drill passed", { exact: true }).waitFor();
  await desktop.getByText("8/8 steps passed", { exact: true }).waitFor();
  const routingPdf = await PDFDocument.create();
  routingPdf.addPage([612, 792]);
  const routingScenario = await desktop.evaluate(async ({ activeCompanyId, pdfBase64, fieldIds, documentKey }) => {
    const bytes = Uint8Array.from(atob(pdfBase64), (character) => character.charCodeAt(0));
    const fields = [
      { id: fieldIds[0], roleKey: "provider", type: "signature", page: 1, x: 0.1, y: 0.68, width: 0.36, height: 0.08, label: "Provider signature", required: true },
      { id: fieldIds[1], roleKey: "counterparty", type: "signature", page: 1, x: 0.54, y: 0.68, width: 0.36, height: 0.08, label: "Counterparty signature", required: true },
    ];
    const encodedFields = btoa(JSON.stringify(fields)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const documentResponse = await fetch(`/api/eos/companies/${activeCompanyId}/native-esign/documents?documentKey=${encodeURIComponent(documentKey)}&documentVersion=1.0&title=${encodeURIComponent("Browser staged-routing agreement")}&sourceReference=${encodeURIComponent("e2e://native-esign/staged-routing")}`, {
      method: "POST", headers: { "Content-Type": "application/pdf", "x-eos-field-schema": encodedFields }, body: bytes,
    });
    const document = await documentResponse.json();
    if (!documentResponse.ok) throw new Error(`routing document registration failed: ${documentResponse.status} ${JSON.stringify(document)}`);
    const subject = `Browser sequential routing ${documentKey}`;
    const envelopeResponse = await fetch(`/api/eos/companies/${activeCompanyId}/native-esign/envelopes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentVersionId: document.id, subject, message: "Provider signs before the counterparty.", routingMode: "sequential", assuranceMode: "link", expiresAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(), recipients: [{ roleKey: "provider", routingOrder: 1, signerName: "Routing Provider", signerEmail: "routing-provider@example.test" }, { roleKey: "counterparty", routingOrder: 2, signerName: "Routing Counterparty", signerEmail: "routing-counterparty@example.test" }] }),
    });
    const envelope = await envelopeResponse.json();
    if (!envelopeResponse.ok) throw new Error(`routing envelope creation failed: ${envelopeResponse.status} ${JSON.stringify(envelope)}`);
    const issueResponse = await fetch(`/api/eos/companies/${activeCompanyId}/native-esign/envelopes/${envelope.id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const issued = await issueResponse.json();
    if (!issueResponse.ok) throw new Error(`routing envelope issue failed: ${issueResponse.status} ${JSON.stringify(issued)}`);
    const provider = issued.recipients.find((recipient: { roleKey: string }) => recipient.roleKey === "provider");
    const counterparty = issued.recipients.find((recipient: { roleKey: string }) => recipient.roleKey === "counterparty");
    if (!provider || !counterparty) throw new Error(`routing recipients missing: ${JSON.stringify(issued)}`);
    return { envelopeId: envelope.id as string, subject, activeUrl: provider.signingUrl as string, firstState: provider.routingState as string, secondState: counterparty.routingState as string, secondUrl: counterparty.signingUrl as string | null };
  }, { activeCompanyId: empyreanCompile.companyId, pdfBase64: Buffer.from(await routingPdf.save()).toString("base64"), fieldIds: [randomUUID(), randomUUID()], documentKey: `browser-routing-${randomUUID()}` });
  if (routingScenario.firstState !== "active" || routingScenario.secondState !== "waiting" || routingScenario.secondUrl !== null)
    throw new Error(`Sequential issuance projection was unsafe: ${JSON.stringify(routingScenario)}`);
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByPlaceholder("Search envelope subject or message", { exact: true }).fill(routingScenario.subject);
  await desktop.getByText(routingScenario.subject, { exact: true }).first().click();
  await desktop.getByText("Waiting for the earlier routing stage. Email, reminders, and replacement links stay locked.", { exact: true }).waitFor();
  await desktop.goto(routingScenario.activeUrl, { waitUntil: "domcontentloaded" });
  const routingConsentChecks = desktop.getByRole("checkbox");
  await routingConsentChecks.nth(0).check();
  await routingConsentChecks.nth(1).check();
  await desktop.getByRole("button", { name: "Accept and continue", exact: true }).click();
  await desktop.getByText("I intend to sign this document", { exact: false }).locator("xpath=ancestor::label[1]").getByRole("checkbox").check();
  await desktop.getByRole("button", { name: "Sign document", exact: true }).click();
  await desktop.getByRole("heading", { name: "Your signature is recorded", exact: true }).waitFor();
  await desktop.goto(origin + "/company/" + empyreanCompile.companyId + "#systems", { waitUntil: "domcontentloaded" });
  await desktop.getByLabel("Systems").getByRole("tab", { name: "Envelopes", exact: true }).click();
  await desktop.getByPlaceholder("Search envelope subject or message", { exact: true }).fill(routingScenario.subject);
  await desktop.getByText(routingScenario.subject, { exact: true }).first().click();
  await desktop.getByRole("button", { name: "Email", exact: true }).waitFor();
  if (await desktop.getByText("Waiting for the earlier routing stage. Email, reminders, and replacement links stay locked.", { exact: true }).count())
    throw new Error("The second routing stage remained visually locked after the first signature.");
  await desktop.goto(
    origin + "/company/" + empyreanCompile.companyId + "#work-room",
    { waitUntil: "domcontentloaded" },
  );
  await desktop
    .getByText("Verify Empyrean provider and authority map", { exact: true })
    .first()
    .waitFor();

  const publicRateLimitReset = (await fetch(`${apiOrigin}/__fixture/reset-rate-limits`, { method: "POST" })).status;
  if (publicRateLimitReset !== 200) throw new Error(`Browser fixture rate-limit reset failed before the public Recovery journey: ${publicRateLimitReset}`);
  await desktop.evaluate(() => sessionStorage.clear());
  const recoverySessionPromise = desktop.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/eos/recovery-calculator/sessions");
  await desktop.goto(origin + `/recovery?companyId=${empyreanCompile.companyId}`, { waitUntil: "domcontentloaded" });
  const recoverySessionResponse = await recoverySessionPromise;
  if (!recoverySessionResponse.ok()) throw new Error(`Recovery session creation failed: ${recoverySessionResponse.status()} ${await recoverySessionResponse.text()}`);
  await desktop
    .getByRole("heading", {
      name: "See where booked-job opportunity may already be hiding.",
      exact: true,
    })
    .waitFor();
  await desktop.getByLabel("Primary service area").fill("Phoenix metro");
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop.getByLabel("Monthly inbound leads").fill("140");
  await desktop.getByLabel("Missed or unanswered leads (%)").fill("32");
  await desktop.getByLabel("Average first response (minutes)").fill("45");
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop.getByLabel("Open estimates").fill("55");
  await desktop.getByLabel("Average job value").fill("14000");
  await desktop.getByLabel("Estimates now stale (%)").fill("55");
  await desktop.getByRole("button", { name: "Continue", exact: true }).click();
  await desktop.getByLabel("Source-data quality").selectOption("clean");
  await desktop.getByLabel("Follow-up ownership").selectOption("unowned");
  await desktop.getByLabel("Timing").selectOption("within_30_days");
  const modeledResponsePromise = desktop.waitForResponse((response) => response.request().method() === "PUT" && /\/api\/eos\/recovery-calculator\/[^/]+\/inputs$/.test(new URL(response.url()).pathname));
  await desktop
    .getByRole("button", { name: "Model my opportunity", exact: true })
    .click();
  const modeledResponse = await modeledResponsePromise;
  if (!modeledResponse.ok()) throw new Error(`Recovery modeling failed: ${modeledResponse.status()} ${await modeledResponse.text()}`);
  await desktop.getByText("Monthly modeled opportunity", { exact: true }).waitFor();
  await desktop
    .getByRole("button", {
      name: "Unlock the complete breakdown",
      exact: true,
    })
    .click();
  await desktop.getByLabel("First name").fill("Alex");
  await desktop.getByLabel("Company").fill("Example Roofing");
  await desktop.getByLabel("Work email").fill("alex.browser@example.test");
  await desktop.locator('input[type="checkbox"]').check();
  await desktop
    .getByRole("button", { name: "Create my full report", exact: true })
    .click();
  await desktop
    .getByRole("heading", {
      name: "Your modeled opportunity, without the theater.",
      exact: true,
    })
    .waitFor();
  await desktop.getByText("Open estimates", { exact: true }).waitFor();
  await desktop.goto(
    origin + "/company/" + empyreanCompile.companyId + "#commercial",
    { waitUntil: "domcontentloaded" },
  );
  await desktop
    .locator("#recovery-sales-briefs")
    .getByText("Example Roofing", { exact: false })
    .waitFor();
  const recoveryLead = desktop
    .locator("#recovery-sales-briefs article")
    .filter({ hasText: "Example Roofing" });
  await recoveryLead
    .getByRole("button", { name: "Prepare Call 2", exact: true })
    .click();
  await recoveryLead.getByText("Call-2 close packet", { exact: true }).waitFor();
  await recoveryLead.locator("summary").filter({ hasText: "Call-2 close packet" }).click();
  await recoveryLead
    .getByLabel("Buyer / decision makers", { exact: true })
    .fill("Alex Owner");
  await recoveryLead
    .getByRole("button", { name: "Save packet", exact: true })
    .click();
  await desktop
    .getByText("Call-2 evidence and terms saved", { exact: true })
    .waitFor();
  const lockCall2 = recoveryLead.getByRole("button", {
    name: "Lock terms and mark ready",
    exact: true,
  });
  if (!(await lockCall2.isVisible()))
    await recoveryLead
      .locator("summary")
      .filter({ hasText: "Call-2 close packet" })
      .click();
  await lockCall2.click();
  await desktop.getByText("Call-2 packet ready", { exact: true }).waitFor();
  await recoveryLead
    .getByRole("heading", { name: "Record the decision", exact: true })
    .waitFor();
  await recoveryLead.getByText("$5,000", { exact: true }).waitFor();
  await recoveryLead.getByLabel("Decision maker", { exact: true }).fill("Alex Owner");
  await recoveryLead.getByLabel("Next-action date", { exact: true }).fill("2026-09-01T10:00");
  await recoveryLead.getByLabel("Agreement version to send", { exact: true }).fill("recovery-agreement-v1");
  await recoveryLead.getByLabel("Payment path", { exact: true }).fill("Approval-gated hosted Stripe Checkout before agreement issuance.");
  await recoveryLead.getByRole("button", { name: "Record canonical disposition", exact: true }).click();
  await desktop.getByText("Commercial disposition recorded", { exact: true }).waitFor();
  const prepareActivation = recoveryLead.getByRole("button", { name: "Prepare controls", exact: true });
  if (!(await prepareActivation.isVisible()))
    await recoveryLead.locator("summary").filter({ hasText: "Call-2 close packet" }).click();
  await prepareActivation.click();
  await desktop.getByText("Agreement and billing controls prepared", { exact: true }).waitFor();
  await recoveryLead.getByText("Commercial activation", { exact: true }).waitFor();
  await recoveryLead.getByText("1. Counsel-reviewed authority", { exact: true }).waitFor();
  await recoveryLead.getByText("2. Client agreement package", { exact: true }).waitFor();
  await recoveryLead.getByText("3. Fixed-price billing manifest", { exact: true }).waitFor();
  await recoveryLead.getByText("4. Approval-gated provider actions", { exact: true }).waitFor();
  await recoveryLead.getByText("5. Authoritative execution evidence", { exact: true }).waitFor();
  await recoveryLead.getByText("Native signing state", { exact: true }).waitFor();
  await recoveryLead.getByText("$5,000 setup", { exact: true }).waitFor();
  await recoveryLead.getByText("$2,500/month", { exact: true }).waitFor();
  if (await recoveryLead.getByRole("button", { name: /send|charge|checkout|mark paid/i }).count())
    throw new Error("Recovery activation exposed an unauthorized provider-effect control.");

  if (browserErrors.length)
    throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);
  console.log(
    JSON.stringify({
      newFounderOnboarding: {
        emptyState: true,
        portfolioCreation: true,
        organizationCreation: true,
        founderContext: true,
        chosenAssistantName: true,
      },
    }),
  );
  console.log(
    JSON.stringify({
      browserAcceptance: true,
      companyId,
      secondCompanyId,
      surfaces: 10,
      activeModules: 14,
      usableModuleControlCenter: true,
      artifactClosureControl: { canonicalClasses: 22, interactiveInitialization: true, mappedCapabilityBulkInitialization: true, companyWideCoverageInitialization: true, governedPreLiveCampaign: true, mandatoryFailureGate: true, evidenceGatedMaturity: true, evidenceDerivedModuleState: true },
      customerSuccessOperations: {
        canonicalCustomerAccount: true,
        healthOutcomeIssueControls: true,
        consentedReportingAndRenewalBoundary: true,
      },
      productEvolutionOperations: {
        canonicalOfferAnchor: true,
        evidenceBackedFeedback: true,
        compatibilityExperimentReleaseRolloutApply: true,
      },
      integrationOperations: {
        frozenCapabilityContracts: true,
        idempotentRunPlanning: true,
        immutableReceiptsAndRecovery: true,
        fallbackParityCutoverRollback: true,
        allowlistedProviderDispatch: true,
        signedAdapterWebhookIngress: true,
        providerNativeIngress: true,
      },
      operationsGraph: {
        capability: true,
        executableProcess: true,
        resourceAllocation: true,
        linkedWork: true,
        evidence: true,
      },
      financeGraph: {
        sourceBoundary: true,
        financialPlan: true,
        planApproval: true,
        providerReconciliationControls: true,
        allocationControls: true,
        investorRelationsDormant: true,
      },
      systemsGraph: {
        inventory: true,
        adapterBindings: true,
        adapterConfigurationEditing: true,
        healthHistory: true,
        toolEntitlements: true,
        automationControl: true,
        providerVerificationBoundary: true,
      },
      roleSafeNextActions: true,
      roleRenderedJourneys: [
        "founder",
        "portfolio_executive",
        "company_ceo",
        "functional_executive",
        "manager",
        "individual_contributor",
        "external",
      ],
      multiWorkspaceRoleSwitching: true,
      mobileRoleJourney: "individual_contributor",
      hiddenSurfaceRedirect: true,
      reportingTreeVisibility: true,
      hierarchyBuilder: true,
      hierarchySearch: true,
      scalableOperatingQueues: true,
      assistantRenaming: true,
      dormantSurfacePreparation: true,
      teamInvitationLifecycle: { create: true, visible: true, revoke: true },
      teamAdministration: {
        seatUsage: true,
        identityPolicy: true,
        portfolioScopeControl: true,
      },
      interactiveWorkApprovalLoop: true,
      assignedWorkLifecycleInWorkRoom: true,
      twoWaySupportOperations: {
        customerThread: true,
        administratorQueue: true,
        inProductReply: true,
        customerNotification: true,
        actionableNotification: true,
      },
      aiCostOperations: {
        enforcedLimits: true,
        threshold: true,
        ledger: true,
        evidenceReconciliation: true,
      },
      confirmedDecisions: {
        approvalPreview: true,
        rejectionReasonRequired: true,
      },
      guidedEvidenceCompletion: true,
      actionableCommandMetrics: true,
      guidedCompanySetup: true,
      notFoundRecovery: true,
      platformReadinessControls: {
        adminOnly: true,
        layers: 24,
        evidenceRecording: true,
      },
      reachableAccountControls: [
        "profile",
        "explicit company context",
        "privacy",
        "AI spend",
        "billing",
        "support",
        "production readiness",
        "in-app notifications",
      ],
      configurableProviderIntegration: {
        notion: {
          perUser: true,
          verify: true,
          search: true,
          sourceAction: true,
          disconnect: true,
        },
      },
      nativeEsignOperations: {
        rendered: true,
        assuranceSelection: true,
        signedWebhookConfiguration: true,
        recoveryAndReplay: true,
        visualSignatureCapture: true,
        signerVisibleIntegrityVerification: true,
        evidenceCustodyControls: true,
        storageRecoveryDrillControls: true,
        governedContractLibrary: true,
        portfolioContractProposals: true,
        governedJurisdictionPacks: true,
        founderTemplateApproval: true,
        counterpartyDirectory: true,
        generatedAgreementPdf: true,
        searchableEnvelopeQueue: true,
        signerChangeRequest: true,
        bilateralNegotiationThread: true,
        governedReplacementComposer: true,
        exactGeneratedTextComparison: true,
        founderComparisonAcknowledgement: true,
        signerComparisonAcknowledgement: true,
        signerPlacementDisclosure: true,
        sequentialRoutingStages: true,
        governedNegotiationResolution: true,
        cloneRenewalControls: true,
        bulkEnvelopeControls: true,
        scheduledReminderControls: true,
        canonicalObligationPromotion: true,
        evidenceBackedObligationReview: true,
        governedContractControlCenter: true,
        governedContractNoticePreparation: true,
      },
      quarantinedFalseControls: [
        "notification delivery preferences",
        "company-wide AI autonomy",
      ],
      aiSpendControls: true,
      auditReceipts: true,
      compactSquarePageActions: [
        "create portfolio",
        "add organization",
        "refresh workspace",
      ],
      portfolioSwitching: "account panel only",
      desktop: "1440x1000",
      mobile: "390x844",
      movableCommunicationFab: true,
      fullWidthCommunicationDrawer: true,
      contextualCommunicationLaunch: true,
      empyreanReferenceInstance: {
        compiled: true,
        activationBlocked: true,
        canonicalCompanyName: true,
        operatingGraphRendered: true,
      },
      recoveryCalculator: {
        partialResult: true,
        consentGate: true,
        fullReport: true,
        nativeSalesBrief: true,
        liveCalendarFailClosed: true,
        call2PacketReady: true,
        commercialActivationPrepared: true,
        providerReceiptTimeline: true,
        providerEffectsUnavailable: true,
      },
      accessibility: { seriousOrCritical: 0 },
      navigationTiming,
    }),
  );
} finally {
  await browser.close();
}
