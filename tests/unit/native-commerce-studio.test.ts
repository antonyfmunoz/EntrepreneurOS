import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const commerceStudio = readFileSync(new URL("../../client/src/components/native-commerce-studio.tsx", import.meta.url), "utf8");

describe("native commerce studio", () => {
  it("is founder-accessible and requires an explicit commerce tool grant for other roles", () => {
    expect(overlay).toContain("NativeCommerceStudio");
    expect(overlay).toContain('toolEntitlements.has("commerce")');
    expect(overlay).toContain("mayOperateNativeCommerce");
    expect(commerceStudio).toContain('data-testid="native-commerce-studio"');
  });

  it("keeps the offer-to-order-to-service chain in governed native records", () => {
    for (const objectType of ["offer", "order", "subscription", "entitlement"]) expect(commerceStudio).toContain(`objectType: "${objectType}"`);
    expect(commerceStudio).toContain("/instruments/crm");
    expect(commerceStudio).toContain("expectedVersion: object.version");
  });

  it("lets a compiled offer be configured in place instead of requiring a duplicate offer", () => {
    expect(commerceStudio).toContain("native-offer-configure");
    expect(commerceStudio).toContain("Configure native offer");
    expect(commerceStudio).toContain('priceState: "configured"');
    expect(commerceStudio).toContain("This updates the compiled EOS offer in place");
  });

  it("does not claim that an order is paid before an approved provider execution returns a receipt", () => {
    expect(commerceStudio).toContain('paymentExecution: "not_dispatched"');
    expect(commerceStudio).toContain("pending_authorized_collection");
    expect(commerceStudio).toContain("explicit payment boundary");
  });
});
