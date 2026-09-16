import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const controlCenter = readFileSync(
  new URL(
    "../../client/src/components/native-operating-control-center.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("native operating workflow evidence selection", () => {
  it("lets a role attach visible, verified EOS evidence without copying a record identifier", () => {
    expect(controlCenter).toContain('queryKey: [root, "evidence"]');
    expect(controlCenter).toContain('request("GET", `${root}/evidence`)');
    expect(controlCenter).toContain('item.verificationState === "verified"');
    expect(controlCenter).toContain('aria-label="Verified workflow evidence"');
    expect(controlCenter).toContain(
      "Only evidence visible to this role and already verified by EOS can be attached to the run.",
    );
    expect(controlCenter).not.toContain("Verified Evidence ID when required");
  });
});
