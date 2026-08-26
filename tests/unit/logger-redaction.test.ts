import { describe, expect, it } from "vitest";
import { redactedRequestPath } from "../../server/observability/logger";

describe("request telemetry path redaction", () => {
  it.each([
    ["/api/eos/native-esign/public/native-secret/sign", "/api/eos/native-esign/public/[REDACTED]/sign"],
    ["/api/eos/talent-portal/candidate-secret/evidence/files", "/api/eos/talent-portal/[REDACTED]/evidence/files"],
    ["/api/eos/recovery-calculator/recovery-secret/contact", "/api/eos/recovery-calculator/[REDACTED]/contact"],
  ])("removes public bearer credentials from %s", (input, expected) => {
    expect(redactedRequestPath(input)).toBe(expected);
  });

  it("preserves non-secret operator paths", () => {
    expect(redactedRequestPath("/api/eos/companies/17/native-esign/envelopes"))
      .toBe("/api/eos/companies/17/native-esign/envelopes");
  });
});
