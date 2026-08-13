import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

type VendorRecord = {
  id: string;
  name: string;
  serviceCategory: string;
  riskTier: "low" | "medium" | "high" | "critical";
  status: "proposed" | "approved" | "restricted" | "retiring" | "retired";
  dataClasses: string[];
  dpaStatus: "not_required" | "pending" | "executed" | "rejected";
  subprocessorStatus: "not_applicable" | "pending" | "reviewed";
  reviewEvidenceUri: string | null;
  exitPlan: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
};

type Operator = { id: string; email: string; fullName: string | null; current: boolean };

type OwnershipRecord = {
  serviceKey: string;
  displayName: string;
  ownerUserId: string;
  backupOwnerUserId: string | null;
  onCallReference: string;
  escalationReference: string | null;
  availabilityTarget: string;
  latencyTarget: string;
  errorBudgetPolicy: string;
  incidentRunbookUri: string;
  accessReviewEvidenceUri: string | null;
  accessReviewedAt: string | null;
  nextAccessReviewAt: string | null;
};

type VendorForm = Omit<VendorRecord, "id" | "name" | "reviewEvidenceUri" | "lastReviewedAt" | "nextReviewAt"> & {
  dataClassesText: string;
  reviewEvidenceUri: string;
  lastReviewedAt: string;
  nextReviewAt: string;
};

function localDateTime(value: Date | string | null | undefined, fallback: Date): string {
  const parsed = value ? new Date(value) : fallback;
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The record could not be saved.";
  const jsonStart = error.message.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(error.message.slice(jsonStart)) as { message?: string };
      if (body.message) return body.message;
    } catch {}
  }
  return error.message;
}

function vendorId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function ProductionGovernanceControls({ requiredVendors, missingVendors, onChanged }: { requiredVendors: string[]; missingVendors: string[]; onChanged: () => void | Promise<unknown> }) {
  const vendors = useQuery<VendorRecord[]>({ queryKey: ["/api/platform/vendors"] });
  const operators = useQuery<Operator[]>({ queryKey: ["/api/platform/operators"] });
  const ownership = useQuery<OwnershipRecord | null>({ queryKey: ["/api/platform/services/entrepreneuros/ownership"] });
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [vendorForm, setVendorForm] = useState<VendorForm>({ serviceCategory: "Application service", riskTier: "high", status: "approved", dataClasses: [], dataClassesText: "account metadata", dpaStatus: "executed", subprocessorStatus: "reviewed", reviewEvidenceUri: "", exitPlan: "Export required records, revoke credentials, and migrate to the approved replacement.", lastReviewedAt: "", nextReviewAt: "" });
  const [ownershipForm, setOwnershipForm] = useState({ displayName: "EntrepreneurOS", backupOwnerUserId: "", onCallReference: "", escalationReference: "", availabilityTarget: "99.9% monthly", latencyTarget: "p95 under 500ms", errorBudgetPolicy: "Escalate when half of the monthly error budget is consumed.", incidentRunbookUri: "", accessReviewEvidenceUri: "", accessReviewedAt: "", nextAccessReviewAt: "" });

  useEffect(() => {
    if (!selectedVendorName) setSelectedVendorName(missingVendors[0] || requiredVendors[0] || "");
  }, [missingVendors, requiredVendors, selectedVendorName]);

  useEffect(() => {
    if (!selectedVendorName) return;
    const existing = vendors.data?.find((vendor) => vendor.name === selectedVendorName);
    const now = new Date();
    setVendorForm({
      serviceCategory: existing?.serviceCategory || "Application service",
      riskTier: existing?.riskTier || "high",
      status: existing?.status || "approved",
      dataClasses: existing?.dataClasses || [],
      dataClassesText: existing?.dataClasses.join(", ") || "account metadata",
      dpaStatus: existing?.dpaStatus || "executed",
      subprocessorStatus: existing?.subprocessorStatus || "reviewed",
      reviewEvidenceUri: existing?.reviewEvidenceUri || "",
      exitPlan: existing?.exitPlan || "Export required records, revoke credentials, and migrate to the approved replacement.",
      lastReviewedAt: localDateTime(existing?.lastReviewedAt, now),
      nextReviewAt: localDateTime(existing?.nextReviewAt, new Date(now.getTime() + 180 * 86_400_000)),
    });
  }, [selectedVendorName, vendors.data]);

  useEffect(() => {
    const now = new Date();
    const current = ownership.data;
    setOwnershipForm({
      displayName: current?.displayName || "EntrepreneurOS",
      backupOwnerUserId: current?.backupOwnerUserId || "",
      onCallReference: current?.onCallReference || "",
      escalationReference: current?.escalationReference || "",
      availabilityTarget: current?.availabilityTarget || "99.9% monthly",
      latencyTarget: current?.latencyTarget || "p95 under 500ms",
      errorBudgetPolicy: current?.errorBudgetPolicy || "Escalate when half of the monthly error budget is consumed.",
      incidentRunbookUri: current?.incidentRunbookUri || "",
      accessReviewEvidenceUri: current?.accessReviewEvidenceUri || "",
      accessReviewedAt: localDateTime(current?.accessReviewedAt, now),
      nextAccessReviewAt: localDateTime(current?.nextAccessReviewAt, new Date(now.getTime() + 60 * 86_400_000)),
    });
  }, [ownership.data]);

  const saveVendor = useMutation({
    mutationFn: async () => {
      const existing = vendors.data?.find((vendor) => vendor.name === selectedVendorName);
      return (await apiRequest<Response>("PUT", `/api/platform/vendors/${existing?.id || vendorId(selectedVendorName)}`, {
        name: selectedVendorName,
        serviceCategory: vendorForm.serviceCategory,
        riskTier: vendorForm.riskTier,
        status: vendorForm.status,
        dataClasses: vendorForm.dataClassesText.split(",").map((item) => item.trim()).filter(Boolean),
        dpaStatus: vendorForm.dpaStatus,
        subprocessorStatus: vendorForm.subprocessorStatus,
        reviewEvidenceUri: vendorForm.reviewEvidenceUri.trim() || undefined,
        exitPlan: vendorForm.exitPlan.trim(),
        lastReviewedAt: vendorForm.lastReviewedAt ? new Date(vendorForm.lastReviewedAt).toISOString() : undefined,
        nextReviewAt: vendorForm.nextReviewAt ? new Date(vendorForm.nextReviewAt).toISOString() : undefined,
      })).json();
    },
    onSuccess: async () => { await Promise.all([vendors.refetch(), onChanged()]); },
  });

  const saveOwnership = useMutation({
    mutationFn: async () => (await apiRequest<Response>("PUT", "/api/platform/services/entrepreneuros/ownership", {
      ...ownershipForm,
      accessReviewedAt: new Date(ownershipForm.accessReviewedAt).toISOString(),
      nextAccessReviewAt: new Date(ownershipForm.nextAccessReviewAt).toISOString(),
    })).json(),
    onSuccess: async () => { await Promise.all([ownership.refetch(), onChanged()]); },
  });

  const vendorApproved = vendorForm.status !== "approved" || Boolean(vendorForm.reviewEvidenceUri && vendorForm.lastReviewedAt && vendorForm.nextReviewAt && ["executed", "not_required"].includes(vendorForm.dpaStatus) && ["reviewed", "not_applicable"].includes(vendorForm.subprocessorStatus));
  const canSaveVendor = Boolean(selectedVendorName && vendorForm.serviceCategory.trim().length >= 2 && vendorForm.exitPlan.trim().length >= 10 && vendorApproved);
  const canSaveOwnership = Boolean(ownershipForm.backupOwnerUserId && ownershipForm.onCallReference && ownershipForm.escalationReference && ownershipForm.incidentRunbookUri && ownershipForm.accessReviewEvidenceUri && ownershipForm.accessReviewedAt && ownershipForm.nextAccessReviewAt && ownershipForm.errorBudgetPolicy.length >= 10);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">Vendor review</h2><p className="mt-1 text-sm text-muted-foreground">Approve only a current, evidenced provider review with resolved data-processing decisions and an exit plan.</p></div></div>
        {requiredVendors.length === 0 ? <p className="mt-6 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No active production vendors were derived from this environment.</p> : <div className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="vendor-name">Required vendor</Label><Select value={selectedVendorName} onValueChange={setSelectedVendorName}><SelectTrigger id="vendor-name"><SelectValue /></SelectTrigger><SelectContent>{requiredVendors.map((vendor) => <SelectItem key={vendor} value={vendor}>{vendor}{missingVendors.includes(vendor) ? " · review required" : " · current"}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="vendor-category">Service category</Label><Input id="vendor-category" value={vendorForm.serviceCategory} onChange={(event) => setVendorForm((current) => ({ ...current, serviceCategory: event.target.value }))} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="vendor-risk">Risk tier</Label><Select value={vendorForm.riskTier} onValueChange={(riskTier) => setVendorForm((current) => ({ ...current, riskTier: riskTier as VendorForm["riskTier"] }))}><SelectTrigger id="vendor-risk"><SelectValue /></SelectTrigger><SelectContent>{["low", "medium", "high", "critical"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="vendor-status">Review status</Label><Select value={vendorForm.status} onValueChange={(status) => setVendorForm((current) => ({ ...current, status: status as VendorForm["status"] }))}><SelectTrigger id="vendor-status"><SelectValue /></SelectTrigger><SelectContent>{["proposed", "approved", "restricted", "retiring", "retired"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="space-y-2"><Label htmlFor="vendor-data">Data classes</Label><Input id="vendor-data" value={vendorForm.dataClassesText} onChange={(event) => setVendorForm((current) => ({ ...current, dataClassesText: event.target.value }))} placeholder="identity, account metadata" /><p className="text-xs text-muted-foreground">Comma-separated; never enter customer data here.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="vendor-dpa">DPA decision</Label><Select value={vendorForm.dpaStatus} onValueChange={(dpaStatus) => setVendorForm((current) => ({ ...current, dpaStatus: dpaStatus as VendorForm["dpaStatus"] }))}><SelectTrigger id="vendor-dpa"><SelectValue /></SelectTrigger><SelectContent>{["not_required", "pending", "executed", "rejected"].map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="vendor-subprocessors">Subprocessor review</Label><Select value={vendorForm.subprocessorStatus} onValueChange={(subprocessorStatus) => setVendorForm((current) => ({ ...current, subprocessorStatus: subprocessorStatus as VendorForm["subprocessorStatus"] }))}><SelectTrigger id="vendor-subprocessors"><SelectValue /></SelectTrigger><SelectContent>{["not_applicable", "pending", "reviewed"].map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="space-y-2"><Label htmlFor="vendor-evidence">Secret-free review evidence URL</Label><Input id="vendor-evidence" type="url" value={vendorForm.reviewEvidenceUri} onChange={(event) => setVendorForm((current) => ({ ...current, reviewEvidenceUri: event.target.value }))} placeholder="https://evidence.example.com/vendors/review" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="vendor-reviewed">Reviewed at</Label><Input id="vendor-reviewed" type="datetime-local" value={vendorForm.lastReviewedAt} onChange={(event) => setVendorForm((current) => ({ ...current, lastReviewedAt: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="vendor-next-review">Next review</Label><Input id="vendor-next-review" type="datetime-local" value={vendorForm.nextReviewAt} onChange={(event) => setVendorForm((current) => ({ ...current, nextReviewAt: event.target.value }))} /></div></div>
          <div className="space-y-2"><Label htmlFor="vendor-exit">Exit plan</Label><Textarea id="vendor-exit" value={vendorForm.exitPlan} onChange={(event) => setVendorForm((current) => ({ ...current, exitPlan: event.target.value }))} /></div>
          <Button onClick={() => saveVendor.mutate()} disabled={!canSaveVendor || saveVendor.isPending}>{saveVendor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save vendor review</Button>
          {saveVendor.isSuccess && <p className="text-sm text-emerald-700">Vendor record saved and Layer 19 recalculated.</p>}{saveVendor.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(saveVendor.error)}</p>}
        </div>}
      </Card>

      <Card className="rounded-[1.5rem] border-white/70 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">Service ownership</h2><p className="mt-1 text-sm text-muted-foreground">Bind EntrepreneurOS to a distinct backup administrator, real escalation routes, and a current access review.</p></div></div>
        <div className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="service-name">Service name</Label><Input id="service-name" value={ownershipForm.displayName} onChange={(event) => setOwnershipForm((current) => ({ ...current, displayName: event.target.value }))} /></div>
          <div className="space-y-2"><Label htmlFor="backup-owner">Backup platform administrator</Label><Select value={ownershipForm.backupOwnerUserId} onValueChange={(backupOwnerUserId) => setOwnershipForm((current) => ({ ...current, backupOwnerUserId }))}><SelectTrigger id="backup-owner"><SelectValue placeholder="Choose a distinct administrator" /></SelectTrigger><SelectContent>{operators.data?.filter((operator) => !operator.current).map((operator) => <SelectItem key={operator.id} value={operator.id}>{operator.fullName || operator.email}</SelectItem>)}</SelectContent></Select>{operators.data?.filter((operator) => !operator.current).length === 0 && <p className="text-xs text-amber-800">Configure and provision a distinct backup administrator before ownership can pass.</p>}</div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="on-call-url">On-call route</Label><Input id="on-call-url" type="url" value={ownershipForm.onCallReference} onChange={(event) => setOwnershipForm((current) => ({ ...current, onCallReference: event.target.value }))} placeholder="https://operations.example.com/on-call" /></div><div className="space-y-2"><Label htmlFor="escalation-url">Escalation route</Label><Input id="escalation-url" type="url" value={ownershipForm.escalationReference} onChange={(event) => setOwnershipForm((current) => ({ ...current, escalationReference: event.target.value }))} placeholder="https://operations.example.com/escalation" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="availability-target">Availability target</Label><Input id="availability-target" value={ownershipForm.availabilityTarget} onChange={(event) => setOwnershipForm((current) => ({ ...current, availabilityTarget: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="latency-target">Latency target</Label><Input id="latency-target" value={ownershipForm.latencyTarget} onChange={(event) => setOwnershipForm((current) => ({ ...current, latencyTarget: event.target.value }))} /></div></div>
          <div className="space-y-2"><Label htmlFor="error-budget">Error-budget policy</Label><Textarea id="error-budget" value={ownershipForm.errorBudgetPolicy} onChange={(event) => setOwnershipForm((current) => ({ ...current, errorBudgetPolicy: event.target.value }))} /></div>
          <div className="space-y-2"><Label htmlFor="incident-runbook">Incident runbook URL</Label><Input id="incident-runbook" type="url" value={ownershipForm.incidentRunbookUri} onChange={(event) => setOwnershipForm((current) => ({ ...current, incidentRunbookUri: event.target.value }))} /></div>
          <div className="space-y-2"><Label htmlFor="access-review-evidence">Access-review evidence URL</Label><Input id="access-review-evidence" type="url" value={ownershipForm.accessReviewEvidenceUri} onChange={(event) => setOwnershipForm((current) => ({ ...current, accessReviewEvidenceUri: event.target.value }))} /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="access-reviewed">Access reviewed at</Label><Input id="access-reviewed" type="datetime-local" value={ownershipForm.accessReviewedAt} onChange={(event) => setOwnershipForm((current) => ({ ...current, accessReviewedAt: event.target.value }))} /></div><div className="space-y-2"><Label htmlFor="next-access-review">Next access review</Label><Input id="next-access-review" type="datetime-local" value={ownershipForm.nextAccessReviewAt} onChange={(event) => setOwnershipForm((current) => ({ ...current, nextAccessReviewAt: event.target.value }))} /></div></div>
          <Button onClick={() => saveOwnership.mutate()} disabled={!canSaveOwnership || saveOwnership.isPending}>{saveOwnership.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save service ownership</Button>
          {saveOwnership.isSuccess && <p className="text-sm text-emerald-700">Service ownership saved and Layer 20 recalculated.</p>}{saveOwnership.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(saveOwnership.error)}</p>}
        </div>
      </Card>
    </div>
  );
}
