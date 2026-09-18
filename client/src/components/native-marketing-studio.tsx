import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, CirclePause, CirclePlay, DollarSign, Megaphone, Plus, RefreshCw, Target, WandSparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function minor(value: string) {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function dollars(value: unknown) {
  const amount = Number(value || 0) / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function stateVariant(state: string) {
  return state === "active" ? "default" as const : state === "paused" ? "secondary" as const : "outline" as const;
}

export function NativeMarketingStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("Generate qualified discovery calls");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState("");
  const [editingCampaignName, setEditingCampaignName] = useState("");
  const [editingCampaignObjective, setEditingCampaignObjective] = useState("");
  const [editingCampaignBudget, setEditingCampaignBudget] = useState("");
  const [audienceName, setAudienceName] = useState("");
  const [audienceDefinition, setAudienceDefinition] = useState("");
  const [audienceSourceId, setAudienceSourceId] = useState("");
  const [creativeName, setCreativeName] = useState("");
  const [creativeClaim, setCreativeClaim] = useState("");
  const [creativeAssetId, setCreativeAssetId] = useState("");
  const [placementCampaignId, setPlacementCampaignId] = useState("");
  const [placementChannel, setPlacementChannel] = useState("website");
  const [measurementCampaignId, setMeasurementCampaignId] = useState("");
  const [actualSpend, setActualSpend] = useState("");
  const [qualifiedLeads, setQualifiedLeads] = useState("");
  const [error, setError] = useState("");

  const query = useQuery<Json>({
    queryKey: [root, roleScopeKey, "native-marketing"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/ads`)).json(),
  });
  const websiteQuery = useQuery<Json>({
    queryKey: [root, roleScopeKey, "native-marketing-owned-demand"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/websites`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const campaigns = useMemo(() => objects.filter((object) => object.objectType === "campaign"), [objects]);
  const audiences = useMemo(() => objects.filter((object) => object.objectType === "audience"), [objects]);
  const creatives = useMemo(() => objects.filter((object) => object.objectType === "creative"), [objects]);
  const budgets = useMemo(() => objects.filter((object) => object.objectType === "budget"), [objects]);
  const placements = useMemo(() => objects.filter((object) => object.objectType === "placement"), [objects]);
  const ownedDemand = (websiteQuery.data?.objects || []).filter((object: Json) => ["site", "page", "funnel"].includes(object.objectType) && object.state === "active");
  const selectedPlacementCampaign = campaigns.find((item) => item.id === placementCampaignId) || campaigns[0];
  const selectedMeasurementCampaign = campaigns.find((item) => item.id === measurementCampaignId) || campaigns[0];
  const editingCampaign = campaigns.find((item) => item.id === editingCampaignId);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-marketing"] }),
      queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-marketing-owned-demand"] }),
    ]);
  };

  const createCampaign = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "ads", objectType: "campaign", objectKey: `campaign:${safeKey(campaignName)}:${Date.now()}`,
      title: campaignName.trim(), summary: campaignObjective.trim(), classification: "confidential", visibility: "team",
      data: { objective: campaignObjective.trim(), budgetMinor: minor(campaignBudget), currency: "USD", actualSpendMinor: 0, qualifiedLeadCount: 0, operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "campaign_control", delivery: "not_dispatched" }, evidenceIds: [], idempotencyKey: commandKey("native-campaign-create"),
    })).json(),
    onSuccess: async (result) => { setPlacementCampaignId(result.object.id); setMeasurementCampaignId(result.object.id); setCampaignName(""); setCampaignBudget(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createAudience = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "ads", objectType: "audience", objectKey: `audience:${safeKey(audienceName)}:${Date.now()}`,
      title: audienceName.trim(), summary: audienceDefinition.trim() || "Native EOS audience definition.", classification: "confidential", visibility: "team",
      data: { definition: audienceDefinition.trim(), sourceObjectIds: audienceSourceId ? [audienceSourceId] : [], operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "audience_definition" }, evidenceIds: [], idempotencyKey: commandKey("native-audience-create"),
    })).json(),
    onSuccess: async () => { setAudienceName(""); setAudienceDefinition(""); setAudienceSourceId(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const saveCampaign = useMutation({
    mutationFn: async () => {
      if (!editingCampaign) throw new Error("Choose a campaign to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${editingCampaign.id}`, {
        expectedVersion: editingCampaign.version,
        title: editingCampaignName.trim(),
        summary: editingCampaignObjective.trim(),
        data: { ...editingCampaign.data, objective: editingCampaignObjective.trim(), budgetMinor: minor(editingCampaignBudget), currency: String(editingCampaign.data?.currency || "USD"), operatingMode: "native_eos" },
        idempotencyKey: commandKey("native-campaign-configure"),
      })).json();
    },
    onSuccess: async (result) => { setPlacementCampaignId(result.object.id); setMeasurementCampaignId(result.object.id); setEditingCampaignId(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const beginCampaignEdit = (campaign: Json) => {
    setEditingCampaignId(campaign.id);
    setEditingCampaignName(String(campaign.title || ""));
    setEditingCampaignObjective(String(campaign.data?.objective || campaign.summary || ""));
    setEditingCampaignBudget(String(Number(campaign.data?.budgetMinor || 0) / 100));
    setError("");
  };
  const createCreative = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "ads", objectType: "creative", objectKey: `creative:${safeKey(creativeName)}:${Date.now()}`,
      title: creativeName.trim(), summary: creativeClaim.trim(), classification: "confidential", visibility: "team",
      data: { claim: creativeClaim.trim(), assetObjectIds: creativeAssetId ? [creativeAssetId] : [], operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "creative_management" }, evidenceIds: [], idempotencyKey: commandKey("native-creative-create"),
    })).json(),
    onSuccess: async () => { setCreativeName(""); setCreativeClaim(""); setCreativeAssetId(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createPlacement = useMutation({
    mutationFn: async () => {
      if (!selectedPlacementCampaign) throw new Error("Create or select a campaign first.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "ads", objectType: "placement", objectKey: `placement:${safeKey(placementChannel)}:${Date.now()}`,
        title: `${placementChannel} · ${selectedPlacementCampaign.title}`, summary: "Native EOS delivery plan. This does not dispatch to an external provider.", classification: "confidential", visibility: "team", parentObjectId: selectedPlacementCampaign.id,
        data: { campaignObjectId: selectedPlacementCampaign.id, channel: placementChannel, operatingMode: "native_eos" },
        sourceReference: { authority: "native_eos", capability: "placement_planning", delivery: "not_dispatched" }, evidenceIds: [], idempotencyKey: commandKey("native-placement-create"),
      })).json();
    },
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const createBudget = useMutation({
    mutationFn: async (campaign: Json) => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "ads", objectType: "budget", objectKey: `budget:${safeKey(campaign.title)}:${Date.now()}`,
      title: `${campaign.title} budget`, summary: "Native EOS governed campaign ceiling.", classification: "confidential", visibility: "team", parentObjectId: campaign.id,
      data: { campaignObjectId: campaign.id, limitMinor: Number(campaign.data?.budgetMinor || 0), currency: "USD" },
      sourceReference: { authority: "native_eos", capability: "budget_governance" }, evidenceIds: [], idempotencyKey: commandKey("native-budget-create"),
    })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const transition = useMutation({
    mutationFn: async ({ object, state }: { object: Json; state: "active" | "paused" }) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state, rationale: state === "active" ? "Activate the native EOS campaign plan after reviewing objective and budget." : "Pause this native EOS campaign plan pending a governed review.", evidenceIds: [], idempotencyKey: commandKey(`native-campaign-${state}`),
    })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const recordMeasurement = useMutation({
    mutationFn: async () => {
      if (!selectedMeasurementCampaign) throw new Error("Create or select a campaign first.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedMeasurementCampaign.id}`, {
        expectedVersion: selectedMeasurementCampaign.version,
        data: { ...selectedMeasurementCampaign.data, actualSpendMinor: minor(actualSpend), qualifiedLeadCount: Math.max(0, Math.floor(Number(qualifiedLeads || 0) || 0)), measuredAt: new Date().toISOString() },
        idempotencyKey: commandKey("native-campaign-measurement"),
      })).json();
    },
    onSuccess: async () => { setActualSpend(""); setQualifiedLeads(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });

  return <Card data-testid="native-marketing-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />Native Marketing Studio</CardTitle><CardDescription className="mt-1">Plan campaigns, audiences, creatives, budgets, placements, and measured demand directly in EOS. An advertising integration may reconcile an approved campaign later; it is never required for the company to plan, control, or understand growth.</CardDescription></div><Button size="sm" variant="outline" onClick={() => { query.refetch(); websiteQuery.refetch(); }} disabled={query.isFetching || websiteQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${(query.isFetching || websiteQuery.isFetching) ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Marketing command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h3 className="font-semibold">Campaign plan</h3></div><p className="mt-1 text-sm text-muted-foreground">Set an objective and spend ceiling before anything is activated.</p><div className="mt-4 grid gap-3"><Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Campaign name" aria-label="Campaign name" /><Textarea value={campaignObjective} onChange={(event) => setCampaignObjective(event.target.value)} placeholder="What outcome should this campaign create?" aria-label="Campaign objective" /><Input value={campaignBudget} onChange={(event) => setCampaignBudget(event.target.value)} inputMode="decimal" placeholder="Budget ceiling (USD)" aria-label="Campaign budget" /><Button disabled={!canExecute || campaignName.trim().length < 2 || campaignObjective.trim().length < 3 || createCampaign.isPending} onClick={() => createCampaign.mutate()}><Plus className="mr-2 h-4 w-4" />{createCampaign.isPending ? "Creating…" : "Create campaign"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h3 className="font-semibold">Audience definition</h3></div><p className="mt-1 text-sm text-muted-foreground">Use owned demand records as the governed source where applicable; draft an audience before external delivery exists.</p><div className="mt-4 grid gap-3"><Input value={audienceName} onChange={(event) => setAudienceName(event.target.value)} placeholder="Audience name" aria-label="Audience name" /><Textarea value={audienceDefinition} onChange={(event) => setAudienceDefinition(event.target.value)} placeholder="Who is this for and why?" aria-label="Audience definition" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={audienceSourceId} onChange={(event) => setAudienceSourceId(event.target.value)} aria-label="Audience source"><option value="">No owned source selected yet</option>{ownedDemand.map((object: Json) => <option key={object.id} value={object.id}>{object.objectType} · {object.title}</option>)}</select><Button variant="outline" disabled={!canExecute || audienceName.trim().length < 2 || audienceDefinition.trim().length < 3 || createAudience.isPending} onClick={() => createAudience.mutate()}><Plus className="mr-2 h-4 w-4" />{createAudience.isPending ? "Creating…" : "Create audience"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><WandSparkles className="h-4 w-4 text-primary" /><h3 className="font-semibold">Creative library</h3></div><p className="mt-1 text-sm text-muted-foreground">Keep the claim and any governed EOS asset reference with the creative—not trapped in an external ad tool.</p><div className="mt-4 grid gap-3"><Input value={creativeName} onChange={(event) => setCreativeName(event.target.value)} placeholder="Creative name" aria-label="Creative name" /><Textarea value={creativeClaim} onChange={(event) => setCreativeClaim(event.target.value)} placeholder="Approved claim or message" aria-label="Creative claim" /><Input value={creativeAssetId} onChange={(event) => setCreativeAssetId(event.target.value)} placeholder="EOS asset ID (optional)" aria-label="Creative asset reference" /><Button variant="outline" disabled={!canExecute || creativeName.trim().length < 2 || creativeClaim.trim().length < 3 || createCreative.isPending} onClick={() => createCreative.mutate()}><Plus className="mr-2 h-4 w-4" />{createCreative.isPending ? "Creating…" : "Create creative"}</Button></div></section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /><h3 className="font-semibold">Channel and budget controls</h3></div><p className="mt-1 text-sm text-muted-foreground">A placement is an EOS-controlled plan. It does not imply spend or dispatch without a separately configured provider execution path.</p><div className="mt-4 grid gap-3"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedPlacementCampaign?.id || ""} onChange={(event) => setPlacementCampaignId(event.target.value)} aria-label="Placement campaign"><option value="">Select campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={placementChannel} onChange={(event) => setPlacementChannel(event.target.value)} aria-label="Placement channel"><option value="website">Owned website</option><option value="email">Email nurture</option><option value="social">Social distribution</option><option value="search">Search</option><option value="partner">Partner distribution</option></select><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!canExecute || !selectedPlacementCampaign || createPlacement.isPending} onClick={() => createPlacement.mutate()}><Plus className="mr-2 h-4 w-4" />Add placement</Button><Button variant="outline" disabled={!canExecute || !selectedPlacementCampaign || createBudget.isPending} onClick={() => createBudget.mutate(selectedPlacementCampaign)}><DollarSign className="mr-2 h-4 w-4" />{createBudget.isPending ? "Adding…" : "Add budget guardrail"}</Button></div></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Native measurement</h3></div><p className="mt-1 text-sm text-muted-foreground">Record observed spend and qualified demand inside the campaign. These inputs are measured operating data, not an invented provider receipt.</p><div className="mt-4 grid gap-3"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedMeasurementCampaign?.id || ""} onChange={(event) => setMeasurementCampaignId(event.target.value)} aria-label="Measurement campaign"><option value="">Select campaign</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select><div className="grid gap-3 md:grid-cols-2"><Input value={actualSpend} onChange={(event) => setActualSpend(event.target.value)} inputMode="decimal" placeholder="Actual spend (USD)" aria-label="Actual campaign spend" /><Input value={qualifiedLeads} onChange={(event) => setQualifiedLeads(event.target.value)} inputMode="numeric" placeholder="Qualified leads" aria-label="Qualified lead count" /></div><Button variant="outline" disabled={!canExecute || !selectedMeasurementCampaign || recordMeasurement.isPending} onClick={() => recordMeasurement.mutate()}><BarChart3 className="mr-2 h-4 w-4" />{recordMeasurement.isPending ? "Recording…" : "Record measurement"}</Button></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Native operating view</p><h3 className="mt-1 font-semibold">Campaign control board</h3></div><Badge variant="outline">{campaigns.length} campaigns · {audiences.length} audiences · {creatives.length} creatives · {placements.length} placements · {budgets.length} budgets</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-3">{campaigns.map((campaign) => { const campaignPlacements = placements.filter((placement) => placement.data?.campaignObjectId === campaign.id); const hasBudgetGuardrail = budgets.some((budget) => budget.data?.campaignObjectId === campaign.id); return <div key={campaign.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{campaign.title}</p><p className="mt-1 text-xs text-muted-foreground">{campaign.data?.objective || campaign.summary}</p></div><Badge variant={stateVariant(campaign.state)}>{campaign.state}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-background p-2">Ceiling<br /><strong>{dollars(campaign.data?.budgetMinor)}</strong></div><div className="rounded-lg bg-background p-2">Observed spend<br /><strong>{dollars(campaign.data?.actualSpendMinor)}</strong></div><div className="rounded-lg bg-background p-2">Qualified leads<br /><strong>{Number(campaign.data?.qualifiedLeadCount || 0)}</strong></div><div className="rounded-lg bg-background p-2">Placements<br /><strong>{campaignPlacements.length}</strong>{hasBudgetGuardrail ? " · guarded" : ""}</div></div><div className="mt-3 flex flex-wrap gap-2">{canExecute && <Button size="sm" variant="outline" onClick={() => beginCampaignEdit(campaign)}>Edit campaign</Button>}{campaign.state === "draft" && <Button size="sm" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: campaign, state: "active" })}><CirclePlay className="mr-2 h-3.5 w-3.5" />Activate</Button>}{campaign.state === "paused" && <Button size="sm" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: campaign, state: "active" })}><CirclePlay className="mr-2 h-3.5 w-3.5" />Resume</Button>}{campaign.state === "active" && <Button size="sm" variant="outline" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: campaign, state: "paused" })}><CirclePause className="mr-2 h-3.5 w-3.5" />Pause</Button>}</div></div>; })}{!campaigns.length && <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Create the first campaign to make the growth plan visible and controllable inside EOS.</div>}</div>{editingCampaign && <section className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Configure native campaign</p><h4 className="mt-1 font-semibold">{editingCampaign.title}</h4><p className="mt-1 text-xs text-muted-foreground">This updates the EOS-owned campaign plan in place. It does not dispatch media or create a provider-side campaign.</p></div><Button size="sm" variant="ghost" onClick={() => setEditingCampaignId("")}>Cancel</Button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div><Label htmlFor="marketing-edit-campaign-name">Campaign name</Label><Input id="marketing-edit-campaign-name" className="mt-1" value={editingCampaignName} onChange={(event) => setEditingCampaignName(event.target.value)} /></div><div><Label htmlFor="marketing-edit-campaign-budget">Budget ceiling (USD)</Label><Input id="marketing-edit-campaign-budget" className="mt-1" value={editingCampaignBudget} onChange={(event) => setEditingCampaignBudget(event.target.value)} inputMode="decimal" /></div><div className="md:col-span-2"><Label htmlFor="marketing-edit-campaign-objective">Campaign objective</Label><Textarea id="marketing-edit-campaign-objective" className="mt-1" value={editingCampaignObjective} onChange={(event) => setEditingCampaignObjective(event.target.value)} /></div><div className="md:col-span-2 flex justify-end"><Button disabled={!canExecute || editingCampaignName.trim().length < 2 || editingCampaignObjective.trim().length < 3 || saveCampaign.isPending} onClick={() => saveCampaign.mutate()}>{saveCampaign.isPending ? "Saving campaign…" : "Save native campaign"}</Button></div></div></section>}</section>
      <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Native first, provider ready</AlertTitle><AlertDescription>EOS owns the campaign plan, audience definition, creative claim, budget ceiling, placements, and measured outcome. A connected provider can later reconcile governed records and execute an approved action with a receipt; this studio does not pretend a plan has already spent money, bought media, or published a message.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
