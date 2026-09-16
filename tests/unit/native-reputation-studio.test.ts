import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-reputation-studio.tsx", import.meta.url), "utf8");

describe("native reputation studio", () => {
  it("gives the founder the surface by default and requires a reputation tool grant for other roles", () => {
    expect(overlay).toContain("NativeReputationStudio");
    expect(overlay).toContain('toolEntitlements.has("reputation")');
    expect(overlay).toContain("mayOperateNativeReputation");
  });

  it("keeps requests, reviews, responses, testimonials, and rating summaries as governed EOS records", () => {
    expect(studio).toContain('objectType: "review_request"');
    expect(studio).toContain('objectType: "review"');
    expect(studio).toContain('objectType: "response"');
    expect(studio).toContain('objectType: "testimonial"');
    expect(studio).toContain('objectType: "rating_summary"');
    expect(studio).toContain("consentReference");
    expect(studio).toContain("expectedVersion: object.version");
  });

  it("does not misrepresent native planning or evidence as external publication or delivery", () => {
    expect(studio).toContain('delivery: "not_dispatched"');
    expect(studio).toContain("does not send email, SMS, or a provider message");
    expect(studio).toContain("does not claim an external message was sent");
  });
});
