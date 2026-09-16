export type NativeBusinessStarter = {
  key: string;
  instrumentKey: "crm" | "forms" | "websites";
  objectType: string;
  title: string;
  summary: string;
  ownerRoleKey: string;
  data: Record<string, unknown>;
};

export function materializeNativeBusinessStarters(input: { companyName: string; offer: string; targetCustomer: string }) : readonly NativeBusinessStarter[] {
  const companyName = input.companyName.trim() || "This company";
  const offer = input.offer.trim() || "the declared offer";
  const targetCustomer = input.targetCustomer.trim() || "the declared customer";
  return [
    { key: "commercial-pipeline", instrumentKey: "crm", objectType: "pipeline", title: `${offer} pipeline`, summary: `Native commercial pipeline for ${targetCustomer}.`, ownerRoleKey: "growth", data: { stages: ["Qualified", "Discovery", "Proposal", "Won", "Lost"], compilerStarter: true } },
    { key: "commercial-intake", instrumentKey: "forms", objectType: "form", title: `${offer} discovery`, summary: `Private native intake draft for ${targetCustomer}.`, ownerRoleKey: "growth", data: { publicCapture: true, compilerStarter: true, questions: [{ id: "name", label: "Full name", type: "short_text", required: true, options: [] }, { id: "email", label: "Work email", type: "email", required: true, options: [] }, { id: "company", label: "Company", type: "short_text", required: false, options: [] }, { id: "goals", label: "What are you looking to accomplish?", type: "long_text", required: false, options: [] }], consentVersion: "native-eos-lead-capture-v1", consentLabel: `I agree that ${companyName} may use my information to respond to my request.`, confirmationMessage: "Thank you. Your request has been received." } },
    { key: "company-site", instrumentKey: "websites", objectType: "site", title: companyName, summary: "EOS-owned native website draft.", ownerRoleKey: "growth", data: { brandName: companyName, compilerStarter: true } },
  ];
}
