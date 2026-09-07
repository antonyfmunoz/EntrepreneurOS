import type { Express, Request, Response } from "express";
import { z } from "zod";
import { legalStatusForUser, publishedLegalDocuments, recordLegalAcceptance } from "../legal/service";

const publicLegalPage = (input: { title: string; summary: string; sections: Array<{ heading: string; body: string }> }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index,follow" />
    <title>${input.title} | EntrepreneurOS</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #202124; background: #faf9fc; }
      body { margin: 0; line-height: 1.6; }
      main { box-sizing: border-box; max-width: 760px; margin: 0 auto; padding: 48px 24px 64px; }
      .eyebrow { color: #6d35d8; font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { font-size: clamp(2rem, 6vw, 3rem); line-height: 1.12; margin: 8px 0 16px; }
      h2 { font-size: 1.15rem; margin: 32px 0 8px; }
      p { margin: 0 0 12px; }
      .summary { color: #50515a; font-size: 1.08rem; }
      footer { border-top: 1px solid #e5e2eb; color: #63636d; font-size: .92rem; margin-top: 40px; padding-top: 20px; }
      a { color: #5a28bc; }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">EntrepreneurOS · Internal use notice · Effective September 7, 2026</p>
      <h1>${input.title}</h1>
      <p class="summary">${input.summary}</p>
      ${input.sections.map((section) => `<section><h2>${section.heading}</h2><p>${section.body}</p></section>`).join("\n      ")}
      <footer>
        <p>EntrepreneurOS is operated by Empyrean Creative LLC for authorized portfolio and company operations.</p>
        <p>Questions or requests: <a href="mailto:antonyfm@empyreanstudios.co">antonyfm@empyreanstudios.co</a>.</p>
      </footer>
    </main>
  </body>
</html>`;

export function registerPublicLegalRoutes(app: Express): void {
  const sendPublicLegalPage = (html: string) => (_req: Request, res: Response) => {
    res.type("html").setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(html);
  };
  app.get("/terms", sendPublicLegalPage(publicLegalPage({
    title: "Internal Operator Terms",
    summary: "EntrepreneurOS is a proprietary internal operating environment for Empyrean Creative LLC and its authorized portfolio companies. It is not currently offered as a public or customer-facing software service.",
    sections: [
      { heading: "Private, authorized use only", body: "Access is limited to people and agents given an authenticated role, seat, and company or portfolio scope. EOS is used to operate authorized businesses; it is not a public signup service, marketplace, or consumer application. Each person must use only the authority assigned to their role and protect their account and connected-provider access." },
      { heading: "Company records and connected providers", body: "A company may connect systems such as QuickBooks, Stripe, Google Workspace, Notion, or Slack for an approved operating purpose. Connections are company-owned, subject to the company administrator's authority, and may be disconnected or reauthorized by an authorized administrator. Provider terms continue to govern the underlying service and data." },
      { heading: "Human accountability", body: "EOS records work, evidence, approvals, and audit history. Agents assist within assigned authority; they do not replace the accountable human decision-maker. EOS is not financial, legal, tax, employment, investment, or other professional advice. People with the required authority remain responsible for decisions and for reviewing consequential actions before they take effect." },
      { heading: "No external service commitment", body: "During this proprietary internal phase, EOS does not make a public software-service offer, customer support commitment, or commercial license offer. Any future external offering will have separately reviewed customer terms, privacy disclosures, and any required data-processing terms before launch." },
      { heading: "Changes", body: "Features, provider connections, and this internal notice may change as the operating environment evolves. Material updates will be reflected on this page with a new effective date." },
    ],
  })));
  app.get("/privacy", sendPublicLegalPage(publicLegalPage({
    title: "Privacy Notice",
    summary: "This notice explains how EntrepreneurOS handles information used internally to operate Empyrean Creative LLC and authorized portfolio companies. EOS is not currently a public or customer-facing software service.",
    sections: [
      { heading: "Information processed", body: "EOS may process account and role information, organization records, work and approval history, provider connection metadata, and business records made available through an approved connection. The information processed depends on the company, role, and authorized workflow. Internal users and company administrators remain responsible for entering and connecting information they are authorized to use." },
      { heading: "Purpose and access", body: "Information is used only to operate the internal workspace, enforce company and role boundaries, coordinate approved work, maintain audit evidence, and operate approved provider workflows. EOS is not designed as an advertising, data-broker, or public consumer service. Access is limited by role, company, portfolio, and provider authorization rather than being shared broadly across users." },
      { heading: "Providers and safeguards", body: "EOS uses infrastructure, identity, and approved integration providers to host the service, authenticate authorized users, and operate workflows. Provider credentials are handled as delegated connection material and are not displayed to ordinary workspace users. Access controls, audit records, and provider-specific authorization are used to reduce inappropriate access; no online service can guarantee absolute security." },
      { heading: "Retention and internal requests", body: "Business records and audit evidence are retained for the applicable company operating purpose, continuity needs, and required recordkeeping. An authorized company administrator may request correction, export, disconnection, or deletion review through the contact below; some records may need to be retained for audit, security, or legal obligations. A formal records-retention and external privacy-rights program will be finalized before any public launch." },
      { heading: "Future public launch", body: "Before EOS is offered outside the authorized internal companies, Empyrean Creative LLC will publish reviewed customer-facing terms, privacy disclosures, and data-processing terms appropriate to the released product, jurisdictions, and data flows." },
    ],
  })));
  app.get("/api/legal/documents", async (_req, res, next) => {
    try {
      const documents = await publishedLegalDocuments();
      return res.json(documents.map(({ checksum: _checksum, ...document }) => document));
    } catch (error) { return next(error); }
  });
}

export function registerLegalRoutes(app: Express): void {
  app.get("/api/legal/status", async (req, res, next) => {
    try { return res.json(await legalStatusForUser(req.user.id)); } catch (error) { return next(error); }
  });
  app.post("/api/legal/acceptances", async (req, res, next) => {
    try {
      const { documentId, accepted } = z.object({ documentId: z.string().min(1), accepted: z.literal(true) }).parse(req.body);
      const acceptance = await recordLegalAcceptance({ userId: req.user.id, documentId, ip: req.ip || "unknown", userAgent: req.get("user-agent") || "unknown" });
      return res.status(201).json({ documentId: acceptance.documentId, acceptedAt: acceptance.acceptedAt });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ code: "explicit_acceptance_required", message: "Explicit acceptance is required." });
      return next(error);
    }
  });
}
