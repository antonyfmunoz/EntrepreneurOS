export type NativeBusinessStarter = {
  key: string;
  instrumentKey: "crm" | "forms" | "websites";
  objectType: string;
  title: string;
  summary: string;
  ownerRoleKey: string;
  data: Record<string, unknown>;
};

/**
 * A compiler starter can point to another starter by its stable template key.
 * The company compiler resolves this marker to the UUID of the actual object
 * it creates. Keeping the template key here avoids embedding a tenant's
 * runtime identifiers in the shared business-in-a-box library.
 */
export type NativeBusinessStarterReference = { starterAssetId: string };
export const nativeBusinessStarterReference = (starterAssetId: string): NativeBusinessStarterReference => ({ starterAssetId });

export function materializeNativeBusinessStarters(input: {
  companyName: string;
  offer: string;
  targetCustomer: string;
  /**
   * The active blueprint's accountable commercial seat.  Different business
   * models use different stable keys (for example, `growth` or
   * `brand_growth`), so native commercial assets must not silently fall back
   * to the CEO just because a template was written for a service studio.
   */
  ownerRoleKey?: string;
}) : readonly NativeBusinessStarter[] {
  const companyName = input.companyName.trim() || "This company";
  const offer = input.offer.trim() || "the declared offer";
  const targetCustomer = input.targetCustomer.trim() || "the declared customer";
  const ownerRoleKey = input.ownerRoleKey?.trim() || "growth";
  return [
    { key: "commercial-pipeline", instrumentKey: "crm", objectType: "pipeline", title: `${offer} pipeline`, summary: `Native commercial pipeline for ${targetCustomer}.`, ownerRoleKey, data: { stages: ["Qualified", "Discovery", "Proposal", "Won", "Lost"], compilerStarter: true } },
    { key: "commercial-intake", instrumentKey: "forms", objectType: "form", title: `${offer} discovery`, summary: `Private native intake draft for ${targetCustomer}.`, ownerRoleKey, data: { publicCapture: true, compilerStarter: true, questions: [{ id: "name", label: "Full name", type: "short_text", required: true, options: [] }, { id: "email", label: "Work email", type: "email", required: true, options: [] }, { id: "company", label: "Company", type: "short_text", required: false, options: [] }, { id: "goals", label: "What are you looking to accomplish?", type: "long_text", required: false, options: [] }], consentVersion: "native-eos-lead-capture-v1", consentLabel: `I agree that ${companyName} may use my information to respond to my request.`, confirmationMessage: "Thank you. Your request has been received." } },
    { key: "company-site", instrumentKey: "websites", objectType: "site", title: companyName, summary: "EOS-owned native website draft.", ownerRoleKey, data: { brandName: companyName, compilerStarter: true } },
    {
      key: "commercial-page",
      instrumentKey: "websites",
      objectType: "page",
      title: `${offer} · Start here`,
      summary: `Native public-page draft for ${targetCustomer}.`,
      ownerRoleKey,
      data: {
        publicPage: true,
        compilerStarter: true,
        siteObjectId: nativeBusinessStarterReference("company-site"),
        headline: `${offer} for ${targetCustomer}`,
        supportingCopy: `Start a focused conversation with ${companyName} about ${offer}.`,
        primaryCtaLabel: "Start a conversation",
        primaryCtaTarget: "capture_form",
        primaryCtaTargetId: nativeBusinessStarterReference("commercial-intake"),
        primaryCtaHref: "",
        path: "/start",
        sections: [
          { id: "outcomes", kind: "outcomes", title: "What changes", body: "A focused next step based on your current context.", items: [] },
          { id: "steps", kind: "steps", title: "How it works", body: "", items: ["Share your context", "Review the recommended next step"] },
        ],
      },
    },
    {
      key: "commercial-funnel",
      instrumentKey: "websites",
      objectType: "funnel",
      title: `${offer} · Discovery funnel`,
      summary: `Native funnel draft that routes ${targetCustomer} into EOS intake.`,
      ownerRoleKey,
      data: {
        publicFunnel: true,
        compilerStarter: true,
        headline: `${offer} for ${targetCustomer}`,
        supportingCopy: `Tell ${companyName} what you are trying to accomplish and receive the right next step.`,
        primaryCtaLabel: "Start discovery",
        captureFormObjectId: nativeBusinessStarterReference("commercial-intake"),
      },
    },
  ];
}
