import type { Express } from "express";

/**
 * Receives the one-time OAuth return used only to grant Demo service-integration
 * consent. EOS uses signed JWT service authentication for provider operations;
 * the authorization code is deliberately discarded rather than persisted or
 * exchanged here. This keeps the consent return out of browser history,
 * application state, and telemetry query logging.
 */
export function registerDocusignConsentRoutes(app: Express) {
  app.get("/api/auth/docusign/callback", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");

    if (typeof req.query.error === "string") {
      return res.status(400).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>DocuSign authorization was not completed</title></head>
<body><p>DocuSign authorization was not completed. You may close this window and return to EntrepreneurOS.</p></body></html>`);
    }

    // Do not render or retain the provider's short-lived authorization code.
    return res.status(200).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>DocuSign authorization complete</title></head>
<body><p>DocuSign authorization is complete. Returning to EntrepreneurOS…</p>
<script>history.replaceState({}, "", "/"); window.location.replace("/");</script></body></html>`);
  });
}
