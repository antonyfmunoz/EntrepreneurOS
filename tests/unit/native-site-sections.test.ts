import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { nativeSiteSectionsSchema } from "../../shared/native-site-sections";

const studio = readFileSync(
  new URL(
    "../../client/src/components/native-funnel-studio.tsx",
    import.meta.url,
  ),
  "utf8",
);
const publicPage = readFileSync(
  new URL("../../client/src/pages/public-site-page.tsx", import.meta.url),
  "utf8",
);
const publicRoutes = readFileSync(
  new URL("../../server/routes/public-sites.ts", import.meta.url),
  "utf8",
);

describe("native no-code public page sections", () => {
  it("accepts a bounded reviewed section vocabulary and preserves legacy pages", () => {
    expect(nativeSiteSectionsSchema.parse(undefined)).toEqual([]);
    expect(
      nativeSiteSectionsSchema.parse([
        {
          id: "outcomes",
          kind: "outcomes",
          title: "What changes",
          body: "",
          items: ["A measurable result"],
        },
      ]),
    ).toHaveLength(1);
    expect(() =>
      nativeSiteSectionsSchema.parse([
        {
          id: "script",
          kind: "script",
          title: "Unsafe",
          body: "<script>",
          items: [],
        },
      ]),
    ).toThrow();
  });

  it("keeps authoring, public projection, and rendering on the same section contract", () => {
    expect(studio).toContain("Page sections");
    expect(studio).toContain("sections: pageSections");
    expect(studio).toContain("Use starter sections");
    expect(publicRoutes).toContain("sections: definition.sections");
    expect(publicRoutes).toContain("eos.public-page.v2");
    expect(publicPage).toContain("page.sections.map");
    expect(publicPage).toContain("NativeSiteSection");
  });
});
