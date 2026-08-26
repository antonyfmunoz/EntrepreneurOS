import { describe, expect, it } from "vitest";
import {
  eosInstrumentKeys,
  eosInstrumentManifest,
  instrumentManifestProjection,
  instrumentActivationFindings,
  instrumentDomainFindings,
  instrumentStarterData,
  instrumentObjectCreateSchema,
  instrumentPortableBundleSchema,
  instrumentTransitions,
  mayTransitionInstrumentObject,
} from "@shared/instrument-runtime";

describe("canonical EOS instrument runtime", () => {
  it("contains the complete required Notion instrument manifest", () => {
    expect(eosInstrumentKeys).toHaveLength(25);
    expect(eosInstrumentKeys).toEqual(expect.arrayContaining([
      "docs", "files", "sheets", "slides", "conference_rooms", "finance", "ads", "reputation",
    ]));
    expect(instrumentManifestProjection()).toHaveLength(eosInstrumentKeys.length);
    for (const key of eosInstrumentKeys) {
      expect(eosInstrumentManifest[key].label.length).toBeGreaterThan(1);
      expect(eosInstrumentManifest[key].objectTypes.length).toBeGreaterThan(0);
      expect(eosInstrumentManifest[key].purpose.length).toBeGreaterThan(10);
    }
  });

  it("rejects object types that do not belong to the selected instrument", () => {
    const result = instrumentObjectCreateSchema.safeParse({
      instrumentKey: "ads",
      objectType: "document",
      objectKey: "campaign:one",
      title: "Campaign one",
      data: {},
      sourceReference: {},
      evidenceIds: [],
      idempotencyKey: "create:campaign:one",
    });
    expect(result.success).toBe(false);
  });

  it("accepts governed managed references without accepting arbitrary object types", () => {
    const result = instrumentObjectCreateSchema.parse({
      instrumentKey: "files",
      objectType: "file",
      objectKey: "file:board-pack",
      title: "Board pack",
      data: { storageReference: "vault://eos/files/board-pack" },
      sourceReference: { provider: "s3", objectId: "board-pack.pdf" },
      evidenceIds: [],
      idempotencyKey: "create:file:board-pack",
    });
    expect(result.instrumentKey).toBe("files");
    expect(result.objectType).toBe("file");
  });

  it("uses a bounded lifecycle with terminal archival", () => {
    expect(mayTransitionInstrumentObject("draft", "active")).toBe(true);
    expect(mayTransitionInstrumentObject("active", "completed")).toBe(true);
    expect(mayTransitionInstrumentObject("completed", "active")).toBe(false);
    expect(mayTransitionInstrumentObject("archived", "draft")).toBe(false);
    expect(instrumentTransitions.archived).toEqual([]);
  });

  it("keeps incomplete domain objects in draft until their canonical activation grammar is present", () => {
    expect(instrumentActivationFindings("conference_rooms", "meeting", { startsAt: "2026-08-26T12:00:00Z" }).map((item) => item.path)).toEqual([
      "data.endsAt", "data.participantSeatIds", "data.agenda",
    ]);
    expect(instrumentActivationFindings("conference_rooms", "meeting", {
      startsAt: "2026-08-26T12:00:00Z",
      endsAt: "2026-08-26T13:00:00Z",
      participantSeatIds: ["seat-1"],
      agenda: ["Review operating evidence"],
    })).toEqual([]);
    expect(instrumentActivationFindings("ads", "campaign", { objective: "Acquire qualified demand", budgetMinor: 100_000, currency: "USD" })).toEqual([]);
  });

  it("provides activation-ready guided starters for every canonical object type", () => {
    for (const instrumentKey of eosInstrumentKeys) {
      for (const objectType of eosInstrumentManifest[instrumentKey].objectTypes) {
        const data = instrumentStarterData(instrumentKey, objectType);
        expect(instrumentDomainFindings(instrumentKey, objectType, data), `${instrumentKey}.${objectType}`).toEqual([]);
      }
    }
  });

  it("blocks invalid money, rating, currency, and chronological domain values", () => {
    expect(instrumentDomainFindings("ads", "campaign", { objective: "Demand", budgetMinor: -1, currency: "usd" }).map((item) => item.code)).toEqual(expect.arrayContaining(["instrument_amount_negative", "instrument_currency_invalid"]));
    expect(instrumentDomainFindings("reputation", "review", { rating: 7, sourceReference: {}, receivedAt: "2026-08-26T12:00:00Z" }).map((item) => item.code)).toContain("instrument_rating_out_of_range");
    expect(instrumentDomainFindings("conference_rooms", "meeting", { startsAt: "2026-08-26T13:00:00Z", endsAt: "2026-08-26T12:00:00Z", participantSeatIds: ["seat-1"], agenda: "Review" }).map((item) => item.code)).toContain("instrument_datetime_order_invalid");
  });

  it("accepts only bounded portable bundles with canonical object types and unique source keys", () => {
    const object = { instrumentKey: "docs", objectType: "document", objectKey: "document:portable", title: "Portable brief", summary: "", classification: "confidential", visibility: "organization", data: { body: "Portable", format: "markdown" }, sourceReference: {} };
    expect(instrumentPortableBundleSchema.parse({ schemaVersion: "eos.instrument-bundle.v1", objects: [object], links: [] }).objects).toHaveLength(1);
    expect(instrumentPortableBundleSchema.safeParse({ schemaVersion: "eos.instrument-bundle.v1", objects: [{ ...object, objectType: "campaign" }], links: [] }).success).toBe(false);
    expect(instrumentPortableBundleSchema.safeParse({ schemaVersion: "eos.instrument-bundle.v1", objects: [object, object], links: [] }).success).toBe(false);
    expect(instrumentPortableBundleSchema.safeParse({ schemaVersion: "eos.instrument-bundle.v1", objects: [object], links: [{ source: { instrumentKey: "docs", objectKey: object.objectKey }, target: { instrumentKey: "docs", objectKey: "document:missing" }, relationshipType: "references", metadata: {} }] }).success).toBe(false);
  });
});
