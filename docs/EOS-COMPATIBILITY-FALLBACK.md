# Internal compatibility fallback candidate

This branch is a fallback candidate, not a replacement for the canonical release branch. Do not merge it over the primary release to make a rollback appear successful.

It retains the qualified internal-only runtime, trusted-source upload restrictions, encrypted artifact custody, signed email alerts and all existing permission and payment execution gates. The new Stripe connection-health HTTP path is deliberately disabled: it reports unavailable and never contacts Stripe. Provider evidence and tenant restrictions still apply. No tests or workflows are skipped.

This fallback is intended to remove the new Stripe health path from service while preserving the internal compatibility fixes that the old production image lacks. It is not an independently implemented version of those shared safety fixes and cannot protect against every defect in shared code.

Source checks and a built image are not runtime qualification. Before selection, require an immutable image digest, exact-source successful qualification/security runs using unchanged canonical workflows, compatible migration and configuration proofs, public and authenticated smoke receipts, and explicit approval tied to the deployment and fallback image. Keep EOS payment effects, public paid SaaS and untrusted uploads disabled. Never substitute the current old image's readiness 503 for a passed fallback readiness check.
