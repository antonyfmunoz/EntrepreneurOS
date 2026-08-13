import { describe, expect, it } from "vitest";
import { resolveSettingsCompanyId, settingsCompanyUrl } from "../../client/src/lib/settings-context";

describe("settings company context", () => {
  const companies = [{ id: 11 }, { id: 22 }];

  it("keeps an explicitly requested owned company", () => {
    expect(resolveSettingsCompanyId("22", companies)).toBe(22);
  });

  it("does not silently select the first of several companies", () => {
    expect(resolveSettingsCompanyId(null, companies)).toBeNull();
    expect(resolveSettingsCompanyId("999", companies)).toBeNull();
  });

  it("selects the only available company", () => {
    expect(resolveSettingsCompanyId(null, [{ id: 11 }])).toBe(11);
  });

  it("builds a shareable settings URL", () => {
    expect(settingsCompanyUrl(22)).toBe("/settings?companyId=22");
    expect(settingsCompanyUrl(null)).toBe("/settings");
  });
});
