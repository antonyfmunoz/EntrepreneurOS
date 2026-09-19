import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, ContactRound, Handshake, KanbanSquare, Plus, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type Seat = { id: string; title: string; status?: string };

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}

function stateVariant(state: string) {
  return ["active", "completed"].includes(state) ? "default" as const : "outline" as const;
}

function stagesFrom(value: unknown) {
  return Array.from(new Set(Array.isArray(value) ? value.map(String).map((stage) => stage.trim()).filter(Boolean) : []));
}

function amountMinor(value: string) {
  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : 0;
}

function opportunitiesForRelationship(opportunities: Json[], relationshipId?: string) {
  return relationshipId ? opportunities.filter((opportunity) => opportunity.data?.relationshipObjectId === relationshipId) : opportunities;
}

export function NativeCrmStudio({ root, roleScopeKey, activeSeatId, seats, canCreateFollowUp, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  activeSeatId: string;
  seats: Seat[];
  canCreateFollowUp: boolean;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [editingPersonName, setEditingPersonName] = useState("");
  const [editingPersonEmail, setEditingPersonEmail] = useState("");
  const [editingPersonPhone, setEditingPersonPhone] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [relationshipType, setRelationshipType] = useState("prospect");
  const [editingRelationshipType, setEditingRelationshipType] = useState("prospect");
  const [facetType, setFacetType] = useState("commercial");
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineStages, setPipelineStages] = useState("Qualified, Discovery, Proposal, Won, Lost");
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [editingPipelineId, setEditingPipelineId] = useState("");
  const [editingPipelineName, setEditingPipelineName] = useState("");
  const [editingPipelineStages, setEditingPipelineStages] = useState("");
  const [opportunityName, setOpportunityName] = useState("");
  const [opportunityAmount, setOpportunityAmount] = useState("");
  const [opportunityStage, setOpportunityStage] = useState("Qualified");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [editingOpportunityTitle, setEditingOpportunityTitle] = useState("");
  const [editingOpportunityAmount, setEditingOpportunityAmount] = useState("");
  const [editingOpportunityStage, setEditingOpportunityStage] = useState("Qualified");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpObjective, setFollowUpObjective] = useState("");
  const [followUpOwnerId, setFollowUpOwnerId] = useState(activeSeatId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("focus") !== "native-crm-studio") return;
    document.getElementById("native-crm-studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const query = useQuery<Json>({
    // The cache key prevents a newly selected seat from seeing another role's
    // relationship snapshot. The server remains the source of authorization.
    queryKey: [root, roleScopeKey, "native-crm"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const people = useMemo(() => objects.filter((object) => object.objectType === "person"), [objects]);
  const relationships = useMemo(() => objects.filter((object) => object.objectType === "relationship"), [objects]);
  const facets = useMemo(() => objects.filter((object) => object.objectType === "facet"), [objects]);
  const pipelines = useMemo(() => objects.filter((object) => object.objectType === "pipeline"), [objects]);
  const opportunities = useMemo(() => objects.filter((object) => object.objectType === "opportunity"), [objects]);
  const selectedPerson = people.find((person) => person.id === selectedPersonId) || people[0];
  const selectedPipeline = pipelines.find((pipeline) => pipeline.id === selectedPipelineId) || pipelines[0];
  const editingPipeline = pipelines.find((pipeline) => pipeline.id === editingPipelineId);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const objectId = params.get("nativeObjectId");
    if (params.get("focus") === "native-crm-studio" && objectId && pipelines.some((pipeline) => pipeline.id === objectId)) setSelectedPipelineId(objectId);
  }, [pipelines]);
  const selectedRelationship = relationships.find((relationship) => relationship.id === selectedRelationshipId) || relationships.find((relationship) => relationship.data?.personObjectId === selectedPerson?.id) || relationships[0];
  const selectedOpportunity = opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) || opportunities.find((opportunity) => opportunity.data?.relationshipObjectId === selectedRelationship?.id) || opportunitiesForRelationship(opportunities, selectedRelationship?.id)[0];
  useEffect(() => {
    setEditingPersonName(String(selectedPerson?.data?.displayName || selectedPerson?.title || ""));
    setEditingPersonEmail(String(selectedPerson?.data?.email || ""));
    setEditingPersonPhone(String(selectedPerson?.data?.phone || ""));
  }, [selectedPerson?.id, selectedPerson?.version]);
  useEffect(() => {
    setEditingRelationshipType(String(selectedRelationship?.data?.relationshipType || "prospect"));
  }, [selectedRelationship?.id, selectedRelationship?.version]);
  useEffect(() => {
    setEditingOpportunityTitle(String(selectedOpportunity?.title || ""));
    setEditingOpportunityAmount(selectedOpportunity?.data?.amountMinor === undefined || selectedOpportunity?.data?.amountMinor === null ? "" : String(Number(selectedOpportunity.data.amountMinor) / 100));
    setEditingOpportunityStage(String(selectedOpportunity?.data?.stage || "Qualified"));
    setFollowUpTitle(selectedOpportunity ? `Follow up: ${selectedOpportunity.title}` : "");
    setFollowUpObjective(String(selectedOpportunity?.data?.nextAction || ""));
    setFollowUpOwnerId(String(selectedOpportunity?.data?.nextActionOwnerSeatId || activeSeatId));
  }, [selectedOpportunity?.id, selectedOpportunity?.version]);
  const relationshipContextQuery = useQuery<Json>({
    // The server returns only cross-instrument objects the current role can
    // already inspect. This relationship view is a composition surface, not
    // a way for CRM to enumerate another team's Messages or Conference Rooms.
    queryKey: [root, roleScopeKey, "native-crm-relationship-operating-context", selectedRelationship?.id],
    enabled: Boolean(selectedRelationship?.id),
    retry: false,
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm/relationships/${selectedRelationship!.id}/operating-context`)).json(),
  });
  const stages = stagesFrom(selectedPipeline?.data?.stages);
  const effectiveStages = stages.length ? stages : ["Qualified", "Discovery", "Proposal", "Won", "Lost"];
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-crm"] });

  const createPerson = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "crm", objectType: "person", objectKey: `person:${safeKey(personName)}:${Date.now()}`,
      title: personName.trim(), summary: personEmail.trim() || "Native EOS relationship record.", classification: "confidential", visibility: "team",
      data: { displayName: personName.trim(), email: personEmail.trim(), phone: personPhone.trim() },
      sourceReference: { authority: "native_eos", capability: "relationship_management" }, evidenceIds: [], idempotencyKey: commandKey("crm-person"),
    })).json(),
    onSuccess: async (result) => { setSelectedPersonId(result.object.id); setPersonName(""); setPersonEmail(""); setPersonPhone(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const savePerson = useMutation({
    mutationFn: async () => {
      if (!selectedPerson) throw new Error("Select a person to configure.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedPerson.id}`, {
        expectedVersion: selectedPerson.version,
        title: editingPersonName.trim(),
        summary: editingPersonEmail.trim() || "Native EOS relationship record.",
        data: { ...selectedPerson.data, displayName: editingPersonName.trim(), email: editingPersonEmail.trim(), phone: editingPersonPhone.trim(), operatingMode: "native_eos" },
        idempotencyKey: commandKey("crm-person-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedPersonId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createRelationship = useMutation({
    mutationFn: async () => {
      if (!selectedPerson) throw new Error("Create or select a person first.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "crm", objectType: "relationship", objectKey: `relationship:${safeKey(relationshipType)}:${Date.now()}`,
        title: `${relationshipType} · ${selectedPerson.data?.displayName || selectedPerson.title}`, summary: "Native EOS relationship context.", classification: "confidential", visibility: "team", parentObjectId: selectedPerson.id,
        data: { personObjectId: selectedPerson.id, relationshipType }, sourceReference: { authority: "native_eos", capability: "relationship_management" }, evidenceIds: [], idempotencyKey: commandKey("crm-relationship"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedPerson.id, targetObjectId: result.object.id, relationshipType: "has_relationship", metadata: {}, idempotencyKey: commandKey("crm-link-relationship") });
      return result;
    },
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const saveRelationship = useMutation({
    mutationFn: async () => {
      if (!selectedRelationship) throw new Error("Select a relationship to configure.");
      const person = relationshipPerson(selectedRelationship);
      const personLabel = person?.data?.displayName || person?.title || "relationship";
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedRelationship.id}`, {
        expectedVersion: selectedRelationship.version,
        title: `${editingRelationshipType} · ${personLabel}`,
        data: { ...selectedRelationship.data, relationshipType: editingRelationshipType, operatingMode: "native_eos" },
        idempotencyKey: commandKey("crm-relationship-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedRelationshipId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createFacet = useMutation({
    mutationFn: async () => {
      if (!selectedPerson) throw new Error("Create or select a person first.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "crm", objectType: "facet", objectKey: `facet:${safeKey(facetType)}:${Date.now()}`,
        title: `${facetType} · ${selectedPerson.data?.displayName || selectedPerson.title}`, summary: "A governed facet that groups this relationship for operating work.", classification: "confidential", visibility: "team", parentObjectId: selectedPerson.id,
        data: { personObjectId: selectedPerson.id, facetType }, sourceReference: { authority: "native_eos", capability: "relationship_management" }, evidenceIds: [], idempotencyKey: commandKey("crm-facet"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedPerson.id, targetObjectId: result.object.id, relationshipType: "has_facet", metadata: {}, idempotencyKey: commandKey("crm-link-facet") });
      return result;
    },
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const createPipeline = useMutation({
    mutationFn: async () => {
      const stages = stagesFrom(pipelineStages.split(","));
      if (!stages.length) throw new Error("Add at least one pipeline stage.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "crm", objectType: "pipeline", objectKey: `pipeline:${safeKey(pipelineName)}:${Date.now()}`,
        title: pipelineName.trim(), summary: "Native EOS commercial pipeline.", classification: "confidential", visibility: "team",
        data: { stages }, sourceReference: { authority: "native_eos", capability: "pipeline" }, evidenceIds: [], idempotencyKey: commandKey("crm-pipeline"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedPipelineId(result.object.id); setPipelineName(""); setOpportunityStage(stagesFrom(result.object.data?.stages)[0] || "Qualified"); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createOpportunity = useMutation({
    mutationFn: async () => {
      if (!selectedRelationship) throw new Error("Create or select a relationship before recording an opportunity.");
      const stage = effectiveStages.includes(opportunityStage) ? opportunityStage : effectiveStages[0];
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "crm", objectType: "opportunity", objectKey: `opportunity:${safeKey(opportunityName)}:${Date.now()}`,
        title: opportunityName.trim(), summary: "Native EOS opportunity.", classification: "confidential", visibility: "team", parentObjectId: selectedRelationship.id,
        data: { relationshipObjectId: selectedRelationship.id, pipelineObjectId: selectedPipeline?.id || null, stage, amountMinor: amountMinor(opportunityAmount), currency: "USD" }, sourceReference: { authority: "native_eos", capability: "opportunity" }, evidenceIds: [], idempotencyKey: commandKey("crm-opportunity"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedRelationship.id, targetObjectId: result.object.id, relationshipType: "has_opportunity", metadata: {}, idempotencyKey: commandKey("crm-link-opportunity-relationship") });
      if (selectedPipeline) await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedPipeline.id, targetObjectId: result.object.id, relationshipType: "contains_opportunity", metadata: {}, idempotencyKey: commandKey("crm-link-opportunity-pipeline") });
      return result;
    },
    onSuccess: async (result) => { setSelectedOpportunityId(result.object.id); setOpportunityName(""); setOpportunityAmount(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const saveOpportunity = useMutation({
    mutationFn: async () => {
      if (!selectedOpportunity) throw new Error("Select an opportunity to configure.");
      const pipeline = pipelines.find((item) => item.id === selectedOpportunity.data?.pipelineObjectId) || selectedPipeline;
      const allowedStages = stagesFrom(pipeline?.data?.stages);
      if (allowedStages.length && !allowedStages.includes(editingOpportunityStage)) throw new Error("Choose a stage that belongs to this opportunity's pipeline.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedOpportunity.id}`, {
        expectedVersion: selectedOpportunity.version,
        title: editingOpportunityTitle.trim(),
        data: { ...selectedOpportunity.data, stage: editingOpportunityStage, amountMinor: amountMinor(editingOpportunityAmount), operatingMode: "native_eos" },
        idempotencyKey: commandKey("crm-opportunity-configure"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedOpportunityId(result.object.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createFollowUp = useMutation({
    mutationFn: async () => {
      if (!selectedOpportunity) throw new Error("Select an opportunity before creating its next action.");
      return (await apiRequest("POST", `${root}/crm/opportunities/${selectedOpportunity.id}/follow-up-actions`, {
        expectedOpportunityVersion: selectedOpportunity.version,
        title: followUpTitle.trim(),
        objective: followUpObjective.trim(),
        ownerSeatId: followUpOwnerId,
        idempotencyKey: commandKey("crm-opportunity-follow-up"),
      })).json();
    },
    onSuccess: async (result) => { setSelectedOpportunityId(result.opportunity.id); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const savePipeline = useMutation({
    mutationFn: async () => {
      if (!editingPipeline) throw new Error("Choose a pipeline to configure.");
      const nextStages = stagesFrom(editingPipelineStages.split(","));
      if (!nextStages.length) throw new Error("Add at least one pipeline stage.");
      const orphanedOpportunity = opportunities.find((opportunity) => opportunity.data?.pipelineObjectId === editingPipeline.id && !nextStages.includes(String(opportunity.data?.stage || "")));
      if (orphanedOpportunity) throw new Error(`Move \"${orphanedOpportunity.title}\" before removing its ${orphanedOpportunity.data?.stage || "current"} stage.`);
      return (await apiRequest("PATCH", `${root}/instrument-objects/${editingPipeline.id}`, {
        expectedVersion: editingPipeline.version,
        title: editingPipelineName.trim(),
        data: { ...editingPipeline.data, stages: nextStages, operatingMode: "native_eos" },
        idempotencyKey: commandKey("crm-pipeline-configure"),
      })).json();
    },
    onSuccess: async (result) => {
      const nextStages = stagesFrom(result.object.data?.stages);
      setSelectedPipelineId(result.object.id);
      setOpportunityStage((current) => nextStages.includes(current) ? current : (nextStages[0] || "Qualified"));
      setEditingPipelineId("");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const beginPipelineEdit = (pipeline: Json) => {
    setEditingPipelineId(pipeline.id);
    setEditingPipelineName(String(pipeline.title || ""));
    setEditingPipelineStages(stagesFrom(pipeline.data?.stages).join(", "));
    setError("");
  };
  const moveOpportunity = useMutation({
    mutationFn: async ({ opportunity, stage }: { opportunity: Json; stage: string }) => (await apiRequest("PATCH", `${root}/instrument-objects/${opportunity.id}`, {
      expectedVersion: opportunity.version, data: { ...opportunity.data, stage }, idempotencyKey: commandKey("crm-move-opportunity"),
    })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state: "active", rationale: "Activate this native CRM record for governed company operations.", evidenceIds: [], idempotencyKey: commandKey("crm-activate"),
    })).json(),
    onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });

  const opportunitiesForPipeline = opportunities.filter((opportunity) => !selectedPipeline || opportunity.data?.pipelineObjectId === selectedPipeline.id);
  const relationshipPerson = (relationship: Json) => people.find((person) => person.id === relationship.data?.personObjectId);
  const relationshipOperatingObjects: Json[] = relationshipContextQuery.data?.objects || [];
  const relationshipOperatingGroups = {
    opportunities: relationshipOperatingObjects.filter((object) => object.instrumentKey === "crm" && object.objectType === "opportunity"),
    messages: relationshipOperatingObjects.filter((object) => object.instrumentKey === "messages" && object.objectType === "message"),
    meetings: relationshipOperatingObjects.filter((object) => object.instrumentKey === "conference_rooms" && object.objectType === "meeting"),
    decisions: relationshipOperatingObjects.filter((object) => object.instrumentKey === "conference_rooms" && object.objectType === "decision"),
    bookings: relationshipOperatingObjects.filter((object) => object.instrumentKey === "calendar" && object.objectType === "booking"),
    projects: relationshipOperatingObjects.filter((object) => object.instrumentKey === "projects" && object.objectType === "project"),
    documents: relationshipOperatingObjects.filter((object) => object.instrumentKey === "docs" && object.objectType === "document"),
    workbooks: relationshipOperatingObjects.filter((object) => object.instrumentKey === "sheets" && object.objectType === "workbook"),
  };
  const activeSeats = seats.filter((seat) => seat.status !== "inactive");
  const ownerName = (seatId?: string) => activeSeats.find((seat) => seat.id === seatId)?.title || "Owner not visible";

  return <Card id="native-crm-studio" data-testid="native-crm-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ContactRound className="h-5 w-5 text-primary" />Native Relationship CRM</CardTitle><CardDescription className="mt-1">Operate people, relationship context, commercial facets, pipelines, and opportunities directly in EOS. A connected CRM can reconcile here later; it is never required for the company to operate.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>CRM command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-primary" /><h3 className="font-semibold">People and relationship context</h3></div><p className="mt-1 text-sm text-muted-foreground">Start with a governed person record, then attach relationship and operating facets.</p><div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><Input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Full name" aria-label="Person name" /><Input value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="Email" aria-label="Person email" /></div><Input value={personPhone} onChange={(event) => setPersonPhone(event.target.value)} placeholder="Phone (optional)" aria-label="Person phone" /><Button disabled={!canExecute || personName.trim().length < 2 || createPerson.isPending} onClick={() => createPerson.mutate()}><Plus className="mr-2 h-4 w-4" />{createPerson.isPending ? "Creating…" : "Create person"}</Button></div><div className="mt-4 grid gap-2"><Label htmlFor="crm-person">Selected person</Label><select id="crm-person" className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedPerson?.id || ""} onChange={(event) => setSelectedPersonId(event.target.value)}><option value="">Select a person</option>{people.map((person) => <option key={person.id} value={person.id}>{person.data?.displayName || person.title}</option>)}</select><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)}><option value="prospect">Prospect</option><option value="customer">Customer</option><option value="partner">Partner</option><option value="vendor">Vendor</option><option value="candidate">Candidate</option></select><Button variant="outline" disabled={!canExecute || !selectedPerson || createRelationship.isPending} onClick={() => createRelationship.mutate()}><Handshake className="mr-2 h-4 w-4" />Add relationship</Button></div><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={facetType} onChange={(event) => setFacetType(event.target.value)}><option value="commercial">Commercial</option><option value="delivery">Delivery</option><option value="partner">Partner</option><option value="talent">Talent</option></select><Button variant="outline" disabled={!canExecute || !selectedPerson || createFacet.isPending} onClick={() => createFacet.mutate()}><Plus className="mr-2 h-4 w-4" />Add facet</Button></div></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><KanbanSquare className="h-4 w-4 text-primary" /><h3 className="font-semibold">Pipelines and opportunities</h3></div><p className="mt-1 text-sm text-muted-foreground">Define the company’s actual commercial stages, then move opportunities across them with a recorded versioned change.</p><div className="mt-4 grid gap-3"><Input value={pipelineName} onChange={(event) => setPipelineName(event.target.value)} placeholder="Revenue recovery pipeline" aria-label="Pipeline name" /><Input value={pipelineStages} onChange={(event) => setPipelineStages(event.target.value)} placeholder="Qualified, Discovery, Proposal, Won, Lost" aria-label="Pipeline stages" /><Button disabled={!canExecute || pipelineName.trim().length < 2 || !stagesFrom(pipelineStages.split(",")).length || createPipeline.isPending} onClick={() => createPipeline.mutate()}><Plus className="mr-2 h-4 w-4" />{createPipeline.isPending ? "Creating…" : "Create pipeline"}</Button></div><div className="mt-4 grid gap-2"><Label htmlFor="crm-pipeline">Selected pipeline</Label><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"><select id="crm-pipeline" className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedPipeline?.id || ""} onChange={(event) => { setSelectedPipelineId(event.target.value); const next = pipelines.find((pipeline) => pipeline.id === event.target.value); setOpportunityStage(stagesFrom(next?.data?.stages)[0] || "Qualified"); }}><option value="">All pipelines</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.title}</option>)}</select><Button variant="outline" disabled={!canExecute || !selectedPipeline} onClick={() => selectedPipeline && beginPipelineEdit(selectedPipeline)}>Edit pipeline</Button></div><Label htmlFor="crm-relationship">Opportunity relationship</Label><select id="crm-relationship" className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedRelationship?.id || ""} onChange={(event) => setSelectedRelationshipId(event.target.value)}><option value="">Select a relationship</option>{relationships.map((relationship) => { const person = relationshipPerson(relationship); return <option key={relationship.id} value={relationship.id}>{relationship.relationshipType || relationship.data?.relationshipType || "Relationship"} · {person?.data?.displayName || person?.title || relationship.title}</option>; })}</select><Input value={opportunityName} onChange={(event) => setOpportunityName(event.target.value)} placeholder="Opportunity name" aria-label="Opportunity name" /><div className="grid gap-2 md:grid-cols-2"><Input value={opportunityAmount} onChange={(event) => setOpportunityAmount(event.target.value)} placeholder="Expected amount (USD)" aria-label="Expected opportunity amount" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={opportunityStage} onChange={(event) => setOpportunityStage(event.target.value)}>{effectiveStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></div><Button disabled={!canExecute || !selectedRelationship || opportunityName.trim().length < 2 || createOpportunity.isPending} onClick={() => createOpportunity.mutate()}><BriefcaseBusiness className="mr-2 h-4 w-4" />{createOpportunity.isPending ? "Creating…" : "Create opportunity"}</Button></div></section>
      </div>
      {editingPipeline && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Configure native pipeline</p><h3 className="mt-1 font-semibold">{editingPipeline.title}</h3><p className="mt-1 text-sm text-muted-foreground">Update the operating stages in place. EOS protects opportunities from being stranded in a removed stage.</p></div><Button size="sm" variant="ghost" onClick={() => setEditingPipelineId("")}>Cancel</Button></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"><div><Label htmlFor="crm-edit-pipeline-name">Pipeline name</Label><Input id="crm-edit-pipeline-name" className="mt-1" value={editingPipelineName} onChange={(event) => setEditingPipelineName(event.target.value)} /></div><div><Label htmlFor="crm-edit-pipeline-stages">Stages</Label><Input id="crm-edit-pipeline-stages" className="mt-1" value={editingPipelineStages} onChange={(event) => setEditingPipelineStages(event.target.value)} placeholder="Qualified, Discovery, Proposal, Won, Lost" /></div><div className="flex items-end"><Button disabled={!canExecute || editingPipelineName.trim().length < 2 || !stagesFrom(editingPipelineStages.split(",")).length || savePipeline.isPending} onClick={() => savePipeline.mutate()}>{savePipeline.isPending ? "Saving pipeline…" : "Save native pipeline"}</Button></div></div></section>}
      {selectedRelationship && <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Relationship operating context</p><h3 className="mt-1 font-semibold">{selectedRelationship.title}</h3><p className="mt-1 text-sm text-muted-foreground">Commercial work, governed communication, bookings, projects, documents, workbooks, and meeting decisions connected to this relationship. EOS shows only objects already visible to your role.</p></div><Button size="sm" variant="outline" onClick={() => relationshipContextQuery.refetch()} disabled={relationshipContextQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${relationshipContextQuery.isFetching ? "animate-spin" : ""}`} />Refresh context</Button></div>{relationshipContextQuery.isError && <Alert className="mt-4" variant="destructive"><AlertTitle>Relationship context unavailable</AlertTitle><AlertDescription>The CRM relationship remains available, but EOS could not load its cross-tool context for this role.</AlertDescription></Alert>}<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-8">{(["opportunities", "messages", "bookings", "projects", "documents", "workbooks", "meetings", "decisions"] as const).map((group) => <div key={group} className="rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{group[0].toUpperCase() + group.slice(1)}</p><Badge variant="outline">{relationshipOperatingGroups[group].length}</Badge></div><div className="mt-3 space-y-2">{relationshipOperatingGroups[group].slice(0, 4).map((object) => <div key={object.id} className="rounded-md bg-background p-2 text-xs"><p className="font-medium">{object.title}</p><p className="mt-1 text-muted-foreground">{object.state.replaceAll("_", " ")}{object.summary ? ` · ${object.summary}` : ""}</p></div>)}{!relationshipOperatingGroups[group].length && <p className="text-xs text-muted-foreground">No visible {group}.</p>}</div></div>)}</div></section>}
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Native operating view</p><h3 className="mt-1 font-semibold">Relationship and pipeline board</h3></div><Badge variant="outline">{people.length} people · {relationships.length} relationships · {facets.length} facets</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-5">{effectiveStages.map((stage) => <div key={stage} className="min-h-40 rounded-xl border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{stage}</p><Badge variant="outline">{opportunitiesForPipeline.filter((opportunity) => opportunity.data?.stage === stage).length}</Badge></div><div className="mt-3 space-y-2">{opportunitiesForPipeline.filter((opportunity) => opportunity.data?.stage === stage).map((opportunity) => { const relationship = relationships.find((item) => item.id === opportunity.data?.relationshipObjectId); const person = relationship && relationshipPerson(relationship); return <div key={opportunity.id} className="rounded-lg border bg-background p-2.5"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{opportunity.title}</p><Badge variant={stateVariant(opportunity.state)}>{opportunity.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{person?.data?.displayName || person?.title || "Relationship not visible"}{opportunity.data?.amountMinor ? ` · $${(Number(opportunity.data.amountMinor) / 100).toLocaleString()}` : ""}</p><div className="mt-2 flex flex-wrap gap-1">{stage !== effectiveStages[0] && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canExecute || moveOpportunity.isPending} onClick={() => moveOpportunity.mutate({ opportunity, stage: effectiveStages[Math.max(0, effectiveStages.indexOf(stage) - 1)] })}>←</Button>}{stage !== effectiveStages[effectiveStages.length - 1] && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canExecute || moveOpportunity.isPending} onClick={() => moveOpportunity.mutate({ opportunity, stage: effectiveStages[Math.min(effectiveStages.length - 1, effectiveStages.indexOf(stage) + 1)] })}>Move <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}{opportunity.state === "draft" && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(opportunity)}>Activate</Button>}</div></div>; })}{!opportunitiesForPipeline.some((opportunity) => opportunity.data?.stage === stage) && <p className="text-xs text-muted-foreground">No opportunities.</p>}</div></div>)}</div></section>
      {selectedPerson && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Configure selected person</p><div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label htmlFor="crm-edit-person-name">Name</Label><Input id="crm-edit-person-name" className="mt-1" value={editingPersonName} onChange={(event) => setEditingPersonName(event.target.value)} /></div><div><Label htmlFor="crm-edit-person-email">Email</Label><Input id="crm-edit-person-email" className="mt-1" type="email" value={editingPersonEmail} onChange={(event) => setEditingPersonEmail(event.target.value)} /></div><div><Label htmlFor="crm-edit-person-phone">Phone</Label><Input id="crm-edit-person-phone" className="mt-1" value={editingPersonPhone} onChange={(event) => setEditingPersonPhone(event.target.value)} /></div><div className="flex items-end"><Button size="sm" disabled={!canExecute || editingPersonName.trim().length < 2 || savePerson.isPending} onClick={() => savePerson.mutate()}>{savePerson.isPending ? "Saving…" : "Save native person"}</Button></div></div></section>}
      {selectedRelationship && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4"><p className="eos-label">Configure selected relationship</p><div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><div><Label htmlFor="crm-edit-relationship-type">Relationship type</Label><select id="crm-edit-relationship-type" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingRelationshipType} onChange={(event) => setEditingRelationshipType(event.target.value)}><option value="prospect">Prospect</option><option value="customer">Customer</option><option value="partner">Partner</option><option value="vendor">Vendor</option><option value="candidate">Candidate</option></select></div><div className="flex items-end"><Button size="sm" disabled={!canExecute || saveRelationship.isPending} onClick={() => saveRelationship.mutate()}>{saveRelationship.isPending ? "Saving…" : "Save native relationship"}</Button></div></div></section>}
      {selectedOpportunity && <section className="rounded-xl border border-primary/25 bg-primary/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Configure selected opportunity</p><p className="mt-1 text-sm text-muted-foreground">Change the commercial record in place while keeping its linked relationship and pipeline intact.</p></div>{opportunities.length > 1 && <select aria-label="Opportunity to configure" className="h-9 rounded-md border bg-background px-2 text-sm" value={selectedOpportunity.id} onChange={(event) => setSelectedOpportunityId(event.target.value)}>{opportunities.map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}</select>}</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3"><div><Label htmlFor="crm-edit-opportunity-title">Opportunity name</Label><Input id="crm-edit-opportunity-title" className="mt-1" value={editingOpportunityTitle} onChange={(event) => setEditingOpportunityTitle(event.target.value)} /></div><div><Label htmlFor="crm-edit-opportunity-amount">Expected amount (USD)</Label><Input id="crm-edit-opportunity-amount" className="mt-1" inputMode="decimal" value={editingOpportunityAmount} onChange={(event) => setEditingOpportunityAmount(event.target.value)} /></div><div><Label htmlFor="crm-edit-opportunity-stage">Stage</Label><select id="crm-edit-opportunity-stage" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={editingOpportunityStage} onChange={(event) => setEditingOpportunityStage(event.target.value)}>{stagesFrom((pipelines.find((item) => item.id === selectedOpportunity.data?.pipelineObjectId) || selectedPipeline)?.data?.stages).map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></div><div className="md:col-span-3"><Button size="sm" disabled={!canExecute || editingOpportunityTitle.trim().length < 2 || saveOpportunity.isPending} onClick={() => saveOpportunity.mutate()}>{saveOpportunity.isPending ? "Saving…" : "Save native opportunity"}</Button></div></div>
        <div className="mt-5 border-t pt-4">
          <p className="eos-label">Accountable next action</p>
          <p className="mt-1 text-sm text-muted-foreground">Turn this opportunity into one native, role-owned task. EOS records the commercial action, assignee, and relationship together; the task starts as a draft so a consequential activation remains an explicit decision.</p>
          {selectedOpportunity.data?.nextActionTaskObjectId && <p className="mt-2 text-xs text-muted-foreground">Current follow-up: {String(selectedOpportunity.data.nextAction || "No objective recorded")} · {ownerName(String(selectedOpportunity.data.nextActionOwnerSeatId || ""))}</p>}
          {canCreateFollowUp ? <div className="mt-3 grid gap-3 md:grid-cols-2"><div><Label htmlFor="crm-follow-up-title">Task name</Label><Input id="crm-follow-up-title" className="mt-1" value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} /></div><div><Label htmlFor="crm-follow-up-owner">Accountable role</Label><select id="crm-follow-up-owner" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={followUpOwnerId} onChange={(event) => setFollowUpOwnerId(event.target.value)}>{activeSeats.map((seat) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select></div><div className="md:col-span-2"><Label htmlFor="crm-follow-up-objective">Concrete next action</Label><Input id="crm-follow-up-objective" className="mt-1" value={followUpObjective} onChange={(event) => setFollowUpObjective(event.target.value)} placeholder="Confirm fit and book the discovery call" /></div><div className="md:col-span-2"><Button size="sm" disabled={!canExecute || !followUpOwnerId || followUpTitle.trim().length < 2 || followUpObjective.trim().length < 3 || createFollowUp.isPending} onClick={() => createFollowUp.mutate()}>{createFollowUp.isPending ? "Creating follow-up…" : "Create role-owned follow-up"}</Button></div></div> : <p className="mt-3 text-sm text-muted-foreground">Your role can operate CRM but has not been assigned Tasks, so EOS will not create a hidden work item. An authorized leader can assign both tools in Org Studio.</p>}
        </div>
      </section>}
      <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Native first, overlay ready</AlertTitle><AlertDescription>EOS owns the governed people, context, commercial stages, and opportunity state. A connected provider may later import or reconcile records with their source and freshness retained; it cannot become a hidden requirement or bypass EOS authority.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
