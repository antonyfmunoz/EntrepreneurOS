import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const instruments = readFileSync(new URL("../../shared/instrument-runtime.ts", import.meta.url), "utf8");
const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const contentCalendar = readFileSync(new URL("../../client/src/components/native-content-calendar.tsx", import.meta.url), "utf8");

describe("native content calendar", () => {
  it("makes the editorial item a canonical calendar object with an activation grammar", () => {
    expect(instruments).toContain('"content_item"');
    expect(instruments).toContain('content_item: ["contentType", "channel", "scheduledFor", "editorialState"]');
  });

  it("renders with the existing role-scoped native calendar authority", () => {
    expect(overlay).toContain("NativeContentCalendar");
    expect(overlay).toContain("mayOperateNativeCalendar");
    expect(contentCalendar).toContain('data-testid="native-content-calendar"');
    expect(contentCalendar).toContain('instrumentKey: "calendar"');
    expect(contentCalendar).toContain('objectType: "content_item"');
  });

  it("does not represent a content plan as an unverified external publication", () => {
    expect(contentCalendar).toContain('delivery: "not_dispatched"');
    expect(contentCalendar).toContain('publication: "not_dispatched"');
    expect(contentCalendar).toContain('publication: "observed_external"');
    expect(contentCalendar).toContain("External publication evidence");
    expect(contentCalendar).toContain("does not dispatch to a social, email, or web provider");
  });
});
