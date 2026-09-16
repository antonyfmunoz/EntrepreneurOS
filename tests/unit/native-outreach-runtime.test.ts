import { describe, expect, it } from "vitest";
import {
  outreachAttemptCreateSchema,
  outreachAttemptOutcomes,
  outreachChannels,
  outreachSequenceCreateSchema,
  outreachSequenceStates,
} from "@shared/eos-runtime";

describe("native outreach and dialer runtime", () => {
  const relationshipId = "b35a8be3-33dd-4f9e-84ad-616126aea63b";

  it("keeps the native dialer as a bounded, provider-independent relationship queue", () => {
    expect(outreachChannels).toEqual(["phone", "email", "sms", "social", "mixed", "manual"]);
    expect(outreachSequenceStates).toEqual(["draft", "active", "paused", "completed", "cancelled"]);
    expect(outreachSequenceCreateSchema.parse({
      title: "Recovery follow-up",
      relationshipId,
      channel: "phone",
      purpose: "Confirm whether the prospect wants to review its recovery diagnostic.",
      consentBasis: "Recorded request for a recovery diagnostic on 2026-09-16.",
    })).toMatchObject({ channel: "phone", sourceAuthority: "native_eos" });
  });

  it("records a call plan without inventing a provider execution", () => {
    const planned = outreachAttemptCreateSchema.parse({ outcome: "planned" });
    expect(planned.providerReceiptReference).toBeUndefined();
    expect(outreachAttemptOutcomes).toContain(planned.outcome);
    expect(outreachAttemptCreateSchema.safeParse({
      outcome: "planned",
      providerReceiptReference: "provider://call/123",
    }).success).toBe(false);
  });

  it("requires an accountable note when a relationship asks not to be contacted", () => {
    expect(outreachAttemptCreateSchema.safeParse({ outcome: "do_not_contact" }).success).toBe(false);
    expect(outreachAttemptCreateSchema.parse({
      outcome: "do_not_contact",
      note: "Prospect asked by email on 2026-09-16 not to receive phone outreach.",
    }).outcome).toBe("do_not_contact");
  });
});
