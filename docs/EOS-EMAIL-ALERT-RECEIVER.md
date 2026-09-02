# EOS-owned operational email alerts

Approved recipient: `antonyfm@empyreanstudios.co`. Uses the operator's existing connected Gmail authorization; no additional email-service subscription or larger machine is required.

## Configuration

Store these in the EntrepreneurOS / Production vault and deploy through the normal release path:

- `EOS_ALERT_WEBHOOK_URL`: `https://entrepreneuros.net/api/operations/alert-email`.
- `EOS_ALERT_WEBHOOK_SECRET`: a dedicated random HMAC secret, never a Google or Stripe key.
- `EOS_ALERT_EMAIL_SENDER_USER_ID`: the verified local operator ID, which must be a configured platform administrator.
- `EOS_ALERT_EMAIL_SENDER_ADDRESS`: the exact connected mailbox, verified before every send.
- `EOS_ALERT_EMAIL_RECIPIENT`: the fixed approved recipient above.

The existing encrypted Google token stays in its current credential store. The caller cannot select another recipient, mailbox, subject, HTML body, link, CC or BCC. Email contains only a bounded event name, severity, timestamp and receipt hash; raw error data and private payload fields are not forwarded.

## Verification and delivery

`POST /api/operations/alert-email` accepts the existing `eos.operational-alert.v1` wire format. It checks the HMAC over exact request bytes, bounds payloads to 16 KiB, and enforces a five-minute signed-header and payload window before any send. A persistent unique hash claim prevents exact duplicate or concurrent requests from sending twice. Incoming traffic is rate-limited.

Migration `0113_add_alert_email_receipts.sql` adds the durable receipt ledger. The authenticated platform-admin-only `GET /api/platform/alerts/deliveries` returns the latest 100 receipts. `POST /api/platform/alerts/test` remains the normal operator test action.

- `dispatching`: claimed before contacting Gmail. If a process crashes here, reconcile Gmail before any further action.
- `delivered`: Gmail returned a message ID and EOS persisted it. This means provider acceptance, not guaranteed inbox placement or human reading.
- `uncertain`: a send failed, returned no receipt, or could not be fully recorded. EOS will not blindly retry that same signed event; inspect the mailbox and provider records first.

Google profile and send requests have explicit time limits; send retries are disabled. The sender allows up to 35 seconds for the native receiver, while external webhook receivers retain the existing five-second timeout. Receiver failures produce sanitized responses and do not recursively email themselves.

## Boundaries

This in-app receiver does **not** provide independent outage monitoring when the whole application, its database or Gmail is unavailable. Keep external uptime monitoring and operational recovery qualification separate. A vault entry is configuration only, local tests are implementation evidence only, and a real signed test with a persisted Gmail message ID is the delivery proof required after deployment. Alerts do not enable Stripe payments or establish any payment readiness claim.
