import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const commerceStudio = readFileSync(new URL("../../client/src/components/native-commerce-studio.tsx", import.meta.url), "utf8");

describe("native commerce record controls", () => {
  it("keeps orders, subscriptions, and entitlements configurable with version protection", () => {
    expect(commerceStudio).toContain("Configure selected order");
    expect(commerceStudio).toContain("native-order-configure");
    expect(commerceStudio).toContain("expectedVersion: selectedOrder.version");
    expect(commerceStudio).toContain("Configure selected subscription");
    expect(commerceStudio).toContain("native-subscription-configure");
    expect(commerceStudio).toContain("Configure selected entitlement");
    expect(commerceStudio).toContain("native-entitlement-configure");
  });
});
