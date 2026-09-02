# Internal release safety versus payment-launch readiness

Approved operating mode: EOS is an internal tool, not a public paid SaaS offering. Updating it must not require enabling company payments.

The deployment preflight and `/api/ready` runtime probe share `productionDeploymentConfiguration`. They accept the company-payment boundary when either the existing configured-payment check passes, or both `EOS_PUBLIC_PAID_SAAS=false` and `EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED=false` are explicitly set. Missing, misspelled or ambiguous flags do not qualify. Internal mode still rejects platform-billing credentials.

The full operations readiness report continues to use the unchanged `productionRuntimeConfigurationIssues`; it still reports `operatingCompanyPaymentsConfigured` as missing when payments are disabled. External inventory, merchant identity checks, binding health, signed webhook receipts, approvals, parity and live-effect execution gates are unchanged. A successful runtime probe is not payment readiness or a claim that the complete production program has passed.

No other configuration requirement is waived. The normal deployment path still requires protected checks for the exact release, an immutable image, a fresh production backup, isolated migration/restore rehearsal, rollback evidence, explicit release-specific approval, public smoke and signed-in tenant-isolation smoke. This change does not switch on payments, activate products or webhooks, or alter any Stripe account.
