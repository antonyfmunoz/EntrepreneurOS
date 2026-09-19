import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  stakeholderPortalIntakeFormCreateSchema,
  stakeholderPortalIntakeReviewSchema,
  stakeholderPortalIntakeSubmissionSchema,
} from "../../shared/stakeholder-portal";

describe("native client portal onboarding intake contracts", () => {
  const form = {
    formKey: "client-onboarding",
    title: "Client onboarding requirements",
    summary: "Collect private launch context, dependencies, and required access for accountable review.",
    questions: [
      { id: "launch_outcome", label: "What outcome should this launch produce?", type: "long_text", required: true, options: [] },
      { id: "access_requirements", label: "What access is required?", type: "long_text", required: true, options: [] },
    ],
    confirmationMessage: "Your onboarding input was recorded for accountable review.",
  };

  it("accepts structured client onboarding requirements and rejects unsafe form definitions", () => {
    expect(stakeholderPortalIntakeFormCreateSchema.parse(form).questions).toHaveLength(2);
    expect(() => stakeholderPortalIntakeFormCreateSchema.parse({ ...form, questions: [...form.questions, { ...form.questions[0] }] })).toThrow();
    expect(() => stakeholderPortalIntakeFormCreateSchema.parse({ ...form, questions: [{ id: "timing", label: "Timing", type: "select", required: true, options: ["Soon"] }] })).toThrow();
  });

  it("requires an acknowledgement and retains bounded client input only", () => {
    expect(stakeholderPortalIntakeSubmissionSchema.parse({ answers: { launch_outcome: "Start the campaign with the approved audience and launch date." }, acknowledgement: true }).acknowledgement).toBe(true);
    expect(() => stakeholderPortalIntakeSubmissionSchema.parse({ answers: {}, acknowledgement: false })).toThrow();
  });

  it("requires an accountable disposition without misrepresenting raw client input as verified evidence", () => {
    expect(stakeholderPortalIntakeReviewSchema.parse({ disposition: "action_required", reviewerSummary: "The accountable reviewer identified one launch dependency that needs an internal owner before work can begin.", nextAction: "Assign the dependency to the delivery owner and confirm the client access boundary." }).disposition).toBe("action_required");
    expect(() => stakeholderPortalIntakeReviewSchema.parse({ disposition: "acknowledged", reviewerSummary: "Too short", nextAction: "Too short" })).toThrow();
  });

  it("uses the grant-bound private portal route and records submissions as unverified EOS input", () => {
    const routes = readFileSync(resolve(process.cwd(), "server/routes/stakeholder-portal.ts"), "utf8");
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/stakeholder-portal-page.tsx"), "utf8");
    expect(routes).toContain("stakeholder_portal_intake_already_submitted");
    expect(routes).toContain('verificationState: "unverified"');
    expect(routes).toContain("accessGrantId: grant.id");
    expect(routes).toContain("private_eos_client_portal");
    expect(routes).toContain("publicPortalIntakeRateLimit");
    expect(routes).toContain("hasActiveIntake");
    expect(routes).toContain("stakeholder_portal.intake_form.read");
    expect(routes).toContain("eos.stakeholder-portal-intake-review.v2");
    expect(routes).toContain("stakeholder_portal.intake_form.review");
    expect(routes).toContain("human_disposition_only_client_answers_remain_unverified");
    expect(page).toContain("Submit onboarding intake");
    expect(page).toContain("does not automatically grant access, start work, or change any agreement");
  });
});
