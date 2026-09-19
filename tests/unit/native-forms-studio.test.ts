import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-forms-studio.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");

describe("native internal Forms", () => {
  it("keeps internal form authoring and completion available to the Forms role scope without requiring CRM", () => {
    expect(overlay).toContain("mayOperateNativeForms");
    expect(overlay).toContain('toolEntitlements.has("forms")');
    expect(studio).toContain('data-testid="native-forms-studio"');
    expect(studio).toContain('internalCapture: true');
    expect(studio).toContain('`${root}/forms/${openForm.id}/submissions`');
    expect(studio).toContain("Native first, authority-bound");
  });

  it("gives internal submissions a dedicated, validated, receipt-producing server command", () => {
    expect(runtime).toContain("nativeInternalFormDefinitionSchema");
    expect(runtime).toContain("validateInternalFormAnswers");
    expect(runtime).toContain('"/api/eos/companies/:companyId/forms/:formId/submissions"');
    expect(runtime).toContain('"native_form.submit"');
    expect(runtime).toContain("native_form_public_boundary");
    expect(runtime).toContain("native_form_active_definition_immutable");
    expect(runtime).toContain("This native form is unavailable in your current role scope.");
    expect(runtime).toContain('commandType: "form.submit"');
    expect(runtime).toContain('eventType: "form.submission_recorded"');
    expect(runtime).toContain('action: "native_form.submission_recorded"');
  });
});
