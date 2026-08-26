import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BookOpenCheck, CheckCircle2, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type RecordValue = Record<string, any>;
type Props = { root: string; canExecute: boolean; canDecide: boolean };

function scopedUrl(url: string) {
  if (typeof window === "undefined") return url;
  const seat = new URLSearchParams(window.location.search).get("seat");
  if (!seat) return url;
  const scoped = new URL(url, window.location.origin);
  scoped.searchParams.set("seatId", seat);
  return `${scoped.pathname}${scoped.search}`;
}
async function json<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  const response = (await apiRequest(method, scopedUrl(url), body)) as Response;
  return response.json() as Promise<T>;
}

function dateFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function stateBadge(state: string) {
  const variant = ["verified", "applicable_active", "monitoring", "satisfied_closed"].includes(state)
    ? "default"
    : ["overdue_breached", "remediating", "superseded"].includes(state) ? "destructive" : "secondary";
  return <Badge variant={variant as any}>{state.replaceAll("_", " ")}</Badge>;
}

export function ComplianceControlCenter({ root, canExecute, canDecide }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const endpoint = `${root}/compliance`;
  const state = useQuery<RecordValue>({ queryKey: [endpoint], queryFn: () => json("GET", endpoint) });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [endpoint] });
  const fail = (title: string, error: unknown) => toast({ title, description: error instanceof Error ? error.message : String(error), variant: "destructive" });

  const [source, setSource] = useState({
    sourceKey: "", versionLabel: "", title: "", sourceType: "regulation", authoritySystem: "", authoritativeReference: "",
    jurisdictionRegime: "", summary: "", effectiveFrom: dateFromNow(0), effectiveUntil: "", reviewedThrough: dateFromNow(0), nextReviewAt: dateFromNow(180), classification: "confidential",
  });
  const [verification, setVerification] = useState({ sourceId: "", reviewEvidenceId: "", reviewAuthority: "qualified_counsel", reviewerName: "", reviewerOrganization: "", reviewerCredentialReference: "", limitations: "" });
  const [supersession, setSupersession] = useState({ sourceId: "", reason: "" });
  const [requirement, setRequirement] = useState({
    requirementKey: "", requirementType: "obligation", sourceVersionId: "", title: "", description: "", ownerSeatId: "",
    subjectScope: "", sourceRequirement: "", jurisdictionRegime: "", processingPurpose: "", legalBasisClaim: "", retentionTrigger: "", retentionPeriod: "", dispositionMethod: "", dueReviewAt: dateFromNow(90), classification: "confidential",
  });
  const [review, setReview] = useState({ requirementId: "", reviewKind: "applicability", outcome: "applicable", reviewEvidenceId: "", reviewAuthority: "qualified_counsel", reviewerName: "", reviewerOrganization: "", reviewerCredentialReference: "", factsConsidered: "", rationale: "", nextReviewAt: dateFromNow(90) });

  const selectedSource = state.data?.sources?.find((item: RecordValue) => item.id === verification.sourceId);
  const requirementSource = state.data?.sources?.find((item: RecordValue) => item.id === requirement.sourceVersionId);
  const selectedRequirement = state.data?.requirements?.find((item: RecordValue) => item.id === review.requirementId);
  const activeSources = useMemo(() => (state.data?.sources || []).filter((item: RecordValue) => item.current), [state.data?.sources]);

  const prepareSource = useMutation({
    mutationFn: () => json("POST", `${endpoint}/sources`, source),
    onSuccess: async () => { setSource((value) => ({ ...value, sourceKey: "", versionLabel: "", title: "", authoritySystem: "", authoritativeReference: "", jurisdictionRegime: "", summary: "" })); await refresh(); toast({ title: "Source draft preserved", description: "The exact version and content hash are ready for attributable professional review." }); },
    onError: (error) => fail("Source preparation failed", error),
  });
  const verifySource = useMutation({
    mutationFn: () => json("POST", `${endpoint}/sources/${selectedSource.id}/verify`, { expectedContentSha256: selectedSource.contentSha256, ...verification, sourceId: undefined }),
    onSuccess: async () => { setVerification({ sourceId: "", reviewEvidenceId: "", reviewAuthority: "qualified_counsel", reviewerName: "", reviewerOrganization: "", reviewerCredentialReference: "", limitations: "" }); await refresh(); toast({ title: "Source verified", description: "EOS recorded the professional claim and Evidence without asserting independent legal validity." }); },
    onError: (error) => fail("Source verification failed", error),
  });
  const supersedeSource = useMutation({
    mutationFn: () => { const item = state.data?.sources?.find((candidate: RecordValue) => candidate.id === supersession.sourceId); return json("POST", `${endpoint}/sources/${item.id}/supersede`, { expectedContentSha256: item.contentSha256, reason: supersession.reason }); },
    onSuccess: async () => { setSupersession({ sourceId: "", reason: "" }); await refresh(); toast({ title: "Source superseded", description: "Prior custody and dependent requirement lineage remain visible." }); },
    onError: (error) => fail("Source supersession failed", error),
  });
  const createRequirement = useMutation({
    mutationFn: () => json("POST", `${endpoint}/requirements`, { ...requirement, expectedSourceSha256: requirementSource.contentSha256 }),
    onSuccess: async () => { setRequirement((value) => ({ ...value, requirementKey: "", title: "", description: "", subjectScope: "", sourceRequirement: "", processingPurpose: "", legalBasisClaim: "", retentionTrigger: "", retentionPeriod: "", dispositionMethod: "" })); await refresh(); toast({ title: "Compliance requirement registered", description: "It remains identified until an Evidence-backed review establishes the next lifecycle state." }); },
    onError: (error) => fail("Requirement creation failed", error),
  });
  const recordReview = useMutation({
    mutationFn: () => json("POST", `${endpoint}/requirements/${selectedRequirement.id}/reviews`, { expectedVersion: selectedRequirement.version, expectedSourceSha256: selectedRequirement.sourceSha256, ...review, requirementId: undefined, nextReviewAt: review.nextReviewAt || undefined }),
    onSuccess: async () => { setReview({ requirementId: "", reviewKind: "applicability", outcome: "applicable", reviewEvidenceId: "", reviewAuthority: "qualified_counsel", reviewerName: "", reviewerOrganization: "", reviewerCredentialReference: "", factsConsidered: "", rationale: "", nextReviewAt: dateFromNow(90) }); await refresh(); toast({ title: "Attributable review recorded", description: "The append-only receipt and current command state were updated atomically." }); },
    onError: (error) => fail("Compliance review failed", error),
  });

  if (state.isLoading) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading native compliance control state…</CardContent></Card>;
  if (state.isError) return <Alert variant="destructive"><ShieldAlert className="h-4 w-4"/><AlertTitle>Compliance state unavailable</AlertTitle><AlertDescription>Refresh the workspace. EOS will not infer a safe or compliant state while the governed register is unavailable.</AlertDescription></Alert>;

  return <div className="space-y-6" id="compliance-control-center">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Verified sources', state.data?.counts?.verifiedSources || 0], ['Active requirements', state.data?.counts?.activeRequirements || 0], ['Overdue reviews', state.data?.counts?.overdue || 0], ['Ineffective controls', state.data?.counts?.failedControls || 0]].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-6"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></CardContent></Card>)}
    </div>
    <Alert><ShieldAlert className="h-4 w-4"/><AlertTitle>Professional boundary remains explicit</AlertTitle><AlertDescription>{state.data?.boundary}</AlertDescription></Alert>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5"/>Authoritative source custody</CardTitle><CardDescription>Preserve the exact source, jurisdiction, effective window, review freshness, professional attribution, and immutable hash before creating a company requirement.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input aria-label="Compliance source key" placeholder="Source key" value={source.sourceKey} onChange={(e) => setSource((v) => ({ ...v, sourceKey: e.target.value }))}/><Input aria-label="Compliance source version" placeholder="Version label" value={source.versionLabel} onChange={(e) => setSource((v) => ({ ...v, versionLabel: e.target.value }))}/><Input aria-label="Compliance source title" placeholder="Source title" value={source.title} onChange={(e) => setSource((v) => ({ ...v, title: e.target.value }))}/>
          <select aria-label="Compliance source type" className="h-10 rounded-md border bg-background px-3" value={source.sourceType} onChange={(e) => setSource((v) => ({ ...v, sourceType: e.target.value }))}>{["statute","regulation","contract","internal_policy","standard","professional_guidance","consent_notice","other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
          <Input aria-label="Authority system" placeholder="Authoritative publisher or system" value={source.authoritySystem} onChange={(e) => setSource((v) => ({ ...v, authoritySystem: e.target.value }))}/><Input aria-label="Authoritative source reference" placeholder="Exact document, page, or provider reference" value={source.authoritativeReference} onChange={(e) => setSource((v) => ({ ...v, authoritativeReference: e.target.value }))}/><Input aria-label="Source jurisdiction" placeholder="Jurisdiction or regime" value={source.jurisdictionRegime} onChange={(e) => setSource((v) => ({ ...v, jurisdictionRegime: e.target.value }))}/>
          <label className="space-y-1 text-xs text-muted-foreground">Effective from<Input type="date" value={source.effectiveFrom} onChange={(e) => setSource((v) => ({ ...v, effectiveFrom: e.target.value }))}/></label><label className="space-y-1 text-xs text-muted-foreground">Reviewed through<Input type="date" value={source.reviewedThrough} onChange={(e) => setSource((v) => ({ ...v, reviewedThrough: e.target.value }))}/></label><label className="space-y-1 text-xs text-muted-foreground">Next review<Input type="date" value={source.nextReviewAt} onChange={(e) => setSource((v) => ({ ...v, nextReviewAt: e.target.value }))}/></label>
          <Textarea className="md:col-span-2 xl:col-span-3" aria-label="Compliance source summary" placeholder="Bounded summary of what the exact source establishes and does not establish" value={source.summary} onChange={(e) => setSource((v) => ({ ...v, summary: e.target.value }))}/>
          <Button className="w-fit" disabled={!canExecute || prepareSource.isPending || source.sourceKey.length < 2 || source.title.length < 3 || source.authoritativeReference.length < 4 || source.summary.trim().length < 20} onClick={() => prepareSource.mutate()}><Plus className="mr-2 h-4 w-4"/>Prepare source draft</Button>
        </div>
        <div className="space-y-3">{(state.data?.sources || []).map((item: RecordValue) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2">{stateBadge(item.state)}<Badge variant="outline">v{item.sourceVersion}</Badge><Badge variant="outline">{item.sourceType.replaceAll("_", " ")}</Badge>{item.current ? <BadgeCheck className="h-4 w-4 text-primary"/> : null}</div><p className="mt-2 font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.authoritySystem} · {item.jurisdictionRegime} · review by {item.nextReviewAt}</p></div><code className="text-[10px] text-muted-foreground">{item.contentSha256.slice(0, 12)}…</code></div><p className="mt-3 text-sm">{item.summary}</p>
          {item.state === "draft" && canDecide ? verification.sourceId === item.id ? <div className="mt-4 grid gap-2 md:grid-cols-2"><select aria-label="Source review authority" className="h-10 rounded-md border bg-background px-3" value={verification.reviewAuthority} onChange={(e) => setVerification((v) => ({ ...v, reviewAuthority: e.target.value }))}>{["qualified_counsel","privacy_professional","internal_compliance","business_owner"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select aria-label="Source review Evidence" className="h-10 rounded-md border bg-background px-3" value={verification.reviewEvidenceId} onChange={(e) => setVerification((v) => ({ ...v, reviewEvidenceId: e.target.value }))}><option value="">Choose verified review Evidence</option>{(state.data?.evidence || []).map((e: RecordValue) => <option key={e.id} value={e.id}>{e.title} · {e.evidenceType}</option>)}</select><Input placeholder="Reviewer name" value={verification.reviewerName} onChange={(e) => setVerification((v) => ({ ...v, reviewerName: e.target.value }))}/><Input placeholder="Reviewer organization" value={verification.reviewerOrganization} onChange={(e) => setVerification((v) => ({ ...v, reviewerOrganization: e.target.value }))}/><Input placeholder="Credential or engagement reference" value={verification.reviewerCredentialReference} onChange={(e) => setVerification((v) => ({ ...v, reviewerCredentialReference: e.target.value }))}/><Textarea placeholder="Scope limits, assumptions, and required local checks" value={verification.limitations} onChange={(e) => setVerification((v) => ({ ...v, limitations: e.target.value }))}/><div className="flex gap-2 md:col-span-2"><Button size="sm" disabled={verifySource.isPending || !verification.reviewEvidenceId || verification.limitations.trim().length < 20} onClick={() => verifySource.mutate()}><CheckCircle2 className="mr-2 h-4 w-4"/>Verify exact source</Button><Button size="sm" variant="ghost" onClick={() => setVerification((v) => ({ ...v, sourceId: "" }))}>Cancel</Button></div></div> : <Button className="mt-3" size="sm" variant="outline" onClick={() => setVerification((v) => ({ ...v, sourceId: item.id }))}>Record professional verification</Button> : null}
          {item.state === "verified" && canDecide ? supersession.sourceId === item.id ? <div className="mt-3 flex flex-col gap-2 md:flex-row"><Input aria-label="Source supersession reason" placeholder="Why this exact source version can no longer be relied on" value={supersession.reason} onChange={(e) => setSupersession((v) => ({ ...v, reason: e.target.value }))}/><Button size="sm" variant="destructive" disabled={supersession.reason.trim().length < 20 || supersedeSource.isPending} onClick={() => supersedeSource.mutate()}>Supersede</Button><Button size="sm" variant="ghost" onClick={() => setSupersession({ sourceId: "", reason: "" })}>Cancel</Button></div> : <Button className="mt-3" size="sm" variant="ghost" onClick={() => setSupersession({ sourceId: item.id, reason: "" })}>Mark source superseded</Button> : null}
        </div>)}</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Company requirements register</CardTitle><CardDescription>Create an immutable company interpretation only from a current verified source. Rights, consent, policy, retention, obligation, and control records stay distinct.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Input placeholder="Requirement key" value={requirement.requirementKey} onChange={(e) => setRequirement((v) => ({ ...v, requirementKey: e.target.value }))}/><select aria-label="Requirement type" className="h-10 rounded-md border bg-background px-3" value={requirement.requirementType} onChange={(e) => setRequirement((v) => ({ ...v, requirementType: e.target.value }))}>{["obligation","right","consent","policy","retention_rule","control"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select aria-label="Verified compliance source" className="h-10 rounded-md border bg-background px-3" value={requirement.sourceVersionId} onChange={(e) => { const item = activeSources.find((s: RecordValue) => s.id === e.target.value); setRequirement((v) => ({ ...v, sourceVersionId: e.target.value, jurisdictionRegime: item?.jurisdictionRegime || v.jurisdictionRegime })); }}><option value="">Choose current verified source</option>{activeSources.map((item: RecordValue) => <option key={item.id} value={item.id}>{item.title} · v{item.sourceVersion}</option>)}</select><Input placeholder="Requirement title" value={requirement.title} onChange={(e) => setRequirement((v) => ({ ...v, title: e.target.value }))}/><select aria-label="Requirement owner" className="h-10 rounded-md border bg-background px-3" value={requirement.ownerSeatId} onChange={(e) => setRequirement((v) => ({ ...v, ownerSeatId: e.target.value }))}><option value="">Choose accountable seat</option>{(state.data?.seats || []).map((seat: RecordValue) => <option key={seat.id} value={seat.id}>{seat.title}</option>)}</select><Input placeholder="Jurisdiction or regime" value={requirement.jurisdictionRegime} onChange={(e) => setRequirement((v) => ({ ...v, jurisdictionRegime: e.target.value }))}/><Textarea placeholder="Company-specific requirement definition" value={requirement.description} onChange={(e) => setRequirement((v) => ({ ...v, description: e.target.value }))}/><Textarea placeholder="People, data, transactions, assets, or operations in scope" value={requirement.subjectScope} onChange={(e) => setRequirement((v) => ({ ...v, subjectScope: e.target.value }))}/><Textarea placeholder="Exact source requirement or clause reference" value={requirement.sourceRequirement} onChange={(e) => setRequirement((v) => ({ ...v, sourceRequirement: e.target.value }))}/>
          {requirement.requirementType === "consent" ? <><Input placeholder="Bounded processing purpose" value={requirement.processingPurpose} onChange={(e) => setRequirement((v) => ({ ...v, processingPurpose: e.target.value }))}/><Input placeholder="Legal-basis claim for professional review" value={requirement.legalBasisClaim} onChange={(e) => setRequirement((v) => ({ ...v, legalBasisClaim: e.target.value }))}/></> : null}
          {requirement.requirementType === "retention_rule" ? <><Input placeholder="Retention trigger" value={requirement.retentionTrigger} onChange={(e) => setRequirement((v) => ({ ...v, retentionTrigger: e.target.value }))}/><Input placeholder="Retention period" value={requirement.retentionPeriod} onChange={(e) => setRequirement((v) => ({ ...v, retentionPeriod: e.target.value }))}/><Input placeholder="Disposition method" value={requirement.dispositionMethod} onChange={(e) => setRequirement((v) => ({ ...v, dispositionMethod: e.target.value }))}/></> : null}
          <label className="space-y-1 text-xs text-muted-foreground">Due review<Input type="date" value={requirement.dueReviewAt} onChange={(e) => setRequirement((v) => ({ ...v, dueReviewAt: e.target.value }))}/></label><Button className="w-fit self-end" disabled={!canExecute || createRequirement.isPending || !requirement.sourceVersionId || !requirement.ownerSeatId || requirement.description.trim().length < 20 || requirement.subjectScope.trim().length < 3} onClick={() => createRequirement.mutate()}><Plus className="mr-2 h-4 w-4"/>Register requirement</Button>
        </div>
        <div className="space-y-3">{(state.data?.requirements || []).map((item: RecordValue) => { const history = (state.data?.reviews || []).filter((r: RecordValue) => r.requirementId === item.id); return <div key={item.id} className={`rounded-xl border p-4 ${item.overdue ? "border-destructive/50 bg-destructive/5" : ""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2">{stateBadge(item.state)}<Badge variant="outline">{item.requirementType.replaceAll("_", " ")}</Badge>{item.overdue ? <Badge variant="destructive">review overdue</Badge> : null}{item.sourceState !== "verified" ? <Badge variant="destructive">source {item.sourceState}</Badge> : null}</div><p className="mt-2 font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">Owner: {state.data?.seats?.find((s: RecordValue) => s.id === item.ownerSeatId)?.title || "Unresolved"} · review {item.dueReviewAt} · version {item.version}</p></div><code className="text-[10px] text-muted-foreground">{item.definitionSha256.slice(0, 12)}…</code></div><p className="mt-3 text-sm">{item.description}</p><p className="mt-2 text-xs text-muted-foreground">Scope: {item.subjectScope}</p>
          {history.length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium">{history.length} immutable review receipt{history.length === 1 ? "" : "s"}</summary><div className="mt-2 space-y-2">{history.map((receipt: RecordValue) => <div key={receipt.id} className="rounded-lg bg-muted p-3 text-xs"><span className="font-medium">{receipt.reviewKind.replaceAll("_", " ")} · {receipt.outcome.replaceAll("_", " ")}</span><p className="mt-1 text-muted-foreground">{receipt.rationale}</p></div>)}</div></details> : null}
          {!['satisfied_closed','superseded'].includes(item.state) && canExecute ? review.requirementId === item.id ? <div className="mt-4 grid gap-2 md:grid-cols-2"><select aria-label="Compliance review kind" className="h-10 rounded-md border bg-background px-3" value={review.reviewKind} onChange={(e) => setReview((v) => ({ ...v, reviewKind: e.target.value, outcome: e.target.value === 'control_test' ? 'effective' : e.target.value === 'closure' ? 'satisfied' : 'applicable' }))}>{["applicability","periodic_review","control_test","closure"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select aria-label="Compliance review outcome" className="h-10 rounded-md border bg-background px-3" value={review.outcome} onChange={(e) => setReview((v) => ({ ...v, outcome: e.target.value }))}>{(review.reviewKind === 'control_test' ? ['effective','ineffective','inconclusive'] : review.reviewKind === 'closure' ? ['satisfied','not_applicable'] : ['applicable','not_applicable','needs_revision','satisfied','breached']).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select aria-label="Compliance review authority" className="h-10 rounded-md border bg-background px-3" value={review.reviewAuthority} onChange={(e) => setReview((v) => ({ ...v, reviewAuthority: e.target.value }))}>{["qualified_counsel","privacy_professional","internal_compliance","business_owner"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select><select aria-label="Compliance review Evidence" className="h-10 rounded-md border bg-background px-3" value={review.reviewEvidenceId} onChange={(e) => setReview((v) => ({ ...v, reviewEvidenceId: e.target.value }))}><option value="">Choose verified review or test Evidence</option>{(state.data?.evidence || []).map((e: RecordValue) => <option key={e.id} value={e.id}>{e.title} · {e.evidenceType}</option>)}</select><Input placeholder="Reviewer name" value={review.reviewerName} onChange={(e) => setReview((v) => ({ ...v, reviewerName: e.target.value }))}/><Input placeholder="Reviewer organization" value={review.reviewerOrganization} onChange={(e) => setReview((v) => ({ ...v, reviewerOrganization: e.target.value }))}/><Input placeholder="Credential or engagement reference" value={review.reviewerCredentialReference} onChange={(e) => setReview((v) => ({ ...v, reviewerCredentialReference: e.target.value }))}/><label className="space-y-1 text-xs text-muted-foreground">Next review<Input type="date" value={review.nextReviewAt} onChange={(e) => setReview((v) => ({ ...v, nextReviewAt: e.target.value }))}/></label><Textarea placeholder="Company facts, data, transactions, systems, and timing considered" value={review.factsConsidered} onChange={(e) => setReview((v) => ({ ...v, factsConsidered: e.target.value }))}/><Textarea placeholder="Attributable rationale, limits, and next action" value={review.rationale} onChange={(e) => setReview((v) => ({ ...v, rationale: e.target.value }))}/><div className="flex gap-2 md:col-span-2"><Button size="sm" disabled={recordReview.isPending || !review.reviewEvidenceId || review.factsConsidered.trim().length < 20 || review.rationale.trim().length < 20 || (['not_applicable','satisfied','breached'].includes(review.outcome) && !canDecide)} onClick={() => recordReview.mutate()}><CheckCircle2 className="mr-2 h-4 w-4"/>Record immutable review</Button><Button size="sm" variant="ghost" onClick={() => setReview((v) => ({ ...v, requirementId: "" }))}>Cancel</Button></div></div> : <Button className="mt-3" size="sm" variant="outline" onClick={() => setReview((v) => ({ ...v, requirementId: item.id }))}><RefreshCw className="mr-2 h-4 w-4"/>Review or test</Button> : null}
        </div>; })}</div>
      </CardContent>
    </Card>
  </div>;
}
