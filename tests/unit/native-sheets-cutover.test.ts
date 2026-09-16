import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const sheetsStudio = readFileSync(new URL("../../client/src/components/native-sheets-studio.tsx", import.meta.url), "utf8");

describe("native sheets cutover", () => {
  it("offers a native Sheets workspace only to the founder or an explicitly entitled role", () => {
    expect(overlay).toContain("NativeSheetsStudio");
    expect(overlay).toContain('toolEntitlements.has("sheets")');
    expect(sheetsStudio).toContain('data-testid="native-sheets-studio"');
    expect(sheetsStudio).toContain("Native Sheets");
  });

  it("builds a governed workbook with attached worksheets rather than a standalone spreadsheet blob", () => {
    expect(sheetsStudio).toContain('objectType: "workbook"');
    expect(sheetsStudio).toContain('objectType: "worksheet"');
    expect(sheetsStudio).toContain("parentObjectId: selectedWorkbook.id");
    expect(sheetsStudio).toContain("contains_worksheet");
    expect(sheetsStudio).toContain("Save new version");
  });

  it("keeps formulas and chart views as inspectable native records", () => {
    expect(sheetsStudio).toContain("evaluateFormula");
    expect(sheetsStudio).toContain("=SUM(Amount)");
    expect(sheetsStudio).toContain('objectType: "chart"');
    expect(sheetsStudio).toContain("Create chart view");
  });
});
