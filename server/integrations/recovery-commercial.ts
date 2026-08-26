import { createSign } from "node:crypto";
import Stripe from "stripe";
import {
  docusignEnvelopeParameters,
  stripeCheckoutParameters,
} from "@shared/recovery-provider-executions";

type StripeCredential = {
  provider: "stripe";
  secretKey: string;
};

type DocusignCredential = {
  provider: "docusign";
  integrationKey: string;
  userId: string;
  privateKey: string;
  oauthBaseUrl: string;
  apiBaseUrl: string;
};

type Credential = StripeCredential | DocusignCredential;

type Binding = {
  id: string;
  providerKey: string;
  providerAccountReference: string;
  credentialReference: string | null;
};

type RecoveryExecution = {
  id: string;
  operation: string;
  idempotencyKey: string;
};

export type RecoveryCommercialProviderReceipt = Record<string, unknown> & {
  objectType: "checkout_session" | "subscription" | "refund" | "envelope";
  id: string;
};

export type RecoveryCommercialEffect =
  | {
      kind: "stripe_checkout";
      billingManifestId: string;
      agreementInstanceId: string;
      packageKey: string;
      productReference: string;
      setupPriceReference: string;
      recurringPriceReference: string;
      signerEmail: string;
    }
  | {
      kind: "stripe_cancel";
      subscriptionReference: string;
      timing: "immediate" | "period_end";
    }
  | {
      kind: "stripe_refund";
      paymentIntentReference: string;
      setupAmountMinor: number;
      reason: "duplicate" | "fraudulent" | "requested_by_customer";
    }
  | {
      kind: "docusign_send";
      agreementInstanceId: string;
      agreementVersion: string;
      templateReference: string;
      signerName: string;
      signerEmail: string;
    }
  | {
      kind: "docusign_void";
      envelopeReference: string;
      rationale: string;
    };

function credentialMap(): Record<string, Credential> {
  try {
    const parsed = JSON.parse(
      process.env.EOS_RECOVERY_PROVIDER_EXECUTION_CREDENTIALS || "{}",
    );
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, Credential>)
      : {};
  } catch {
    return {};
  }
}

function credentialFor(binding: Binding): Credential {
  if (process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED !== "true")
    throw new Error("Recovery provider effects are disabled by deployment policy.");
  const credentials = credentialMap();
  const credential =
    credentials[binding.id] ||
    (binding.credentialReference
      ? credentials[binding.credentialReference]
      : undefined);
  if (!credential || credential.provider !== binding.providerKey)
    throw new Error("The exact Integration Binding has no execution credential.");
  return credential;
}

export function recoveryCommercialEffectsConfigured(): boolean {
  return (
    process.env.EOS_RECOVERY_PROVIDER_EFFECTS_ENABLED === "true" &&
    Object.keys(credentialMap()).length > 0
  );
}

function publicOrigin(): string {
  const origin = process.env.EOS_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (!origin?.startsWith("https://"))
    throw new Error("EOS_PUBLIC_ORIGIN must be an HTTPS origin.");
  return origin;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function docusignToken(credential: DocusignCredential): Promise<string> {
  const oauth = new URL(credential.oauthBaseUrl);
  const now = Math.floor(Date.now() / 1_000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: credential.integrationKey,
      sub: credential.userId,
      aud: oauth.host,
      iat: now,
      exp: now + 3_000,
      scope: "signature impersonation",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const privateKey = credential.privateKey.replace(/\\n/g, "\n");
  const assertion = `${unsigned}.${base64url(signer.sign(privateKey))}`;
  const response = await fetch(new URL("/oauth/token", oauth), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("DocuSign authorization failed.");
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("DocuSign authorization returned no token.");
  return body.access_token;
}

async function docusignRequest(
  credential: DocusignCredential,
  binding: Binding,
  path: string,
  method: "POST" | "PUT",
  body: unknown,
) {
  const token = await docusignToken(credential);
  const url = new URL(
    `/restapi/v2.1/accounts/${encodeURIComponent(binding.providerAccountReference)}${path}`,
    credential.apiBaseUrl,
  );
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("DocuSign rejected the approved operation.");
  return (await response.json()) as Record<string, unknown>;
}

export async function executeRecoveryCommercialEffect(input: {
  binding: Binding;
  execution: RecoveryExecution;
  effect: RecoveryCommercialEffect;
}): Promise<RecoveryCommercialProviderReceipt> {
  const credential = credentialFor(input.binding);
  if (credential.provider === "stripe") {
    const stripe = new Stripe(credential.secretKey);
    const account = await stripe.accounts.retrieve(null);
    if (account.id !== input.binding.providerAccountReference)
      throw new Error("Stripe execution account does not match the Integration Binding.");
    if (input.effect.kind === "stripe_checkout") {
      const origin = publicOrigin();
      const session = await stripe.checkout.sessions.create(
        stripeCheckoutParameters({
          ...input.effect,
          successUrl: `${origin}/recovery/payment-return?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${origin}/recovery/payment-cancelled`,
        }),
        { idempotencyKey: input.execution.idempotencyKey },
      );
      return {
        objectType: "checkout_session",
        id: session.id,
        url: session.url,
        status: session.status,
        livemode: session.livemode,
      };
    }
    if (input.effect.kind === "stripe_cancel") {
      const subscription = input.effect.timing === "immediate"
        ? await stripe.subscriptions.cancel(
            input.effect.subscriptionReference,
            {},
            { idempotencyKey: input.execution.idempotencyKey },
          )
        : await stripe.subscriptions.update(
            input.effect.subscriptionReference,
            { cancel_at_period_end: true },
            { idempotencyKey: input.execution.idempotencyKey },
          );
      return {
        objectType: "subscription",
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    }
    if (input.effect.kind === "stripe_refund") {
      const refund = await stripe.refunds.create(
        {
          payment_intent: input.effect.paymentIntentReference,
          amount: input.effect.setupAmountMinor,
          reason: input.effect.reason,
          metadata: {
            eos_provider_execution_id: input.execution.id,
            eos_refund_scope: "recovery_setup_only",
          },
        },
        { idempotencyKey: input.execution.idempotencyKey },
      );
      return {
        objectType: "refund",
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        currency: refund.currency,
      };
    }
    throw new Error("Stripe operation and effect do not match.");
  }

  if (input.effect.kind === "docusign_send") {
    const envelope = await docusignRequest(
      credential,
      input.binding,
      "/envelopes",
      "POST",
      docusignEnvelopeParameters({
        executionId: input.execution.id,
        ...input.effect,
      }),
    );
    const envelopeId = typeof envelope.envelopeId === "string"
      ? envelope.envelopeId.trim()
      : "";
    if (!envelopeId) throw new Error("DocuSign accepted the request without returning an envelope reference.");
    return {
      objectType: "envelope",
      id: envelopeId,
      status: envelope.status,
      statusDateTime: envelope.statusDateTime,
    };
  }
  if (input.effect.kind === "docusign_void") {
    const envelope = await docusignRequest(
      credential,
      input.binding,
      `/envelopes/${encodeURIComponent(input.effect.envelopeReference)}`,
      "PUT",
      { status: "voided", voidedReason: input.effect.rationale },
    );
    const envelopeId = typeof envelope.envelopeId === "string"
      ? envelope.envelopeId.trim()
      : input.effect.envelopeReference;
    return {
      objectType: "envelope",
      id: envelopeId,
      status: envelope.status || "voided",
      statusDateTime: envelope.statusDateTime,
    };
  }
  throw new Error("DocuSign operation and effect do not match.");
}
