import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageSquareQuote, Plus, RefreshCw, Send, ShieldCheck, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;

function commandKey(prefix: string) { return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
function safeKey(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"; }
function stateVariant(state: string) { return state === "active" ? "default" as const : state === "completed" ? "secondary" as const : "outline" as const; }

export function NativeReputationStudio({ root, roleScopeKey, activeSeatId, canExecute, canDecide }: {
  root: string; roleScopeKey: string; activeSeatId: string; canExecute: boolean; canDecide: boolean;
}) {
  const [relationshipId, setRelationshipId] = useState("");
  const [requestChannel, setRequestChannel] = useState("email");
  const [requestConsent, setRequestConsent] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewSource, setReviewSource] = useState("");
  const [responseReviewId, setResponseReviewId] = useState("");
  const [responseBody, setResponseBody] = useState("");
  const [testimonialBody, setTestimonialBody] = useState("");
  const [testimonialConsent, setTestimonialConsent] = useState("");
  const [testimonialEvidenceId, setTestimonialEvidenceId] = useState("");
  const [error, setError] = useState("");
  const reputationQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-reputation"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/reputation`)).json() });
  const crmQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-reputation-crm"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json() });
  const objects: Json[] = reputationQuery.data?.objects || [];
  const reviews = useMemo(() => objects.filter((item: Json) => item.objectType === "review"), [objects]);
  const requests = useMemo(() => objects.filter((item: Json) => item.objectType === "review_request"), [objects]);
  const responses = useMemo(() => objects.filter((item: Json) => item.objectType === "response"), [objects]);
  const testimonials = useMemo(() => objects.filter((item: Json) => item.objectType === "testimonial"), [objects]);
  const relationships: Json[] = useMemo(() => (crmQuery.data?.objects || []).filter((item: Json) => item.objectType === "relationship"), [crmQuery.data]);
  const selectedReview = reviews.find((item) => item.id === responseReviewId) || reviews[0];
  const averageRating = reviews.length ? reviews.reduce((total, review) => total + Number(review.data?.rating || 0), 0) / reviews.length : 0;
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-reputation"] }),
    queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-reputation-crm"] }),
  ]);
  const createRequest = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "reputation", objectType: "review_request", objectKey: `review-request:${safeKey(requestChannel)}:${Date.now()}`,
      title: `Review request · ${requestChannel}`, summary: "Consent-aware native EOS review request plan.", classification: "confidential", visibility: "team",
      data: { relationshipObjectId: relationshipId, channel: requestChannel, consentReference: { reference: requestConsent.trim(), status: "verified_for_request" }, operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "reputation_request", delivery: "not_dispatched" }, evidenceIds: [], idempotencyKey: commandKey("native-review-request-create"),
    })).json(),
    onSuccess: async () => { setRequestConsent(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createReview = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "reputation", objectType: "review", objectKey: `review:${safeKey(reviewTitle)}:${Date.now()}`, title: reviewTitle.trim(), summary: "Observed review retained as native EOS reputation evidence.", classification: "confidential", visibility: "team",
      data: { rating: Number(reviewRating), sourceReference: { source: "manually_recorded", locator: reviewSource.trim() }, receivedAt: new Date().toISOString(), operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "review_evidence_capture" }, evidenceIds: [], idempotencyKey: commandKey("native-review-create"),
    })).json(),
    onSuccess: async (result) => { setResponseReviewId(result.object.id); setReviewTitle(""); setReviewSource(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createResponse = useMutation({
    mutationFn: async () => {
      if (!selectedReview) throw new Error("Record or select a review first.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "reputation", objectType: "response", objectKey: `review-response:${safeKey(selectedReview.title)}:${Date.now()}`, title: `Response · ${selectedReview.title}`, summary: responseBody.trim(), classification: "confidential", visibility: "team", parentObjectId: selectedReview.id,
        data: { reviewObjectId: selectedReview.id, body: responseBody.trim(), approvedBySeatId: activeSeatId, operatingMode: "native_eos" },
        sourceReference: { authority: "native_eos", capability: "review_response", delivery: "not_dispatched" }, evidenceIds: [], idempotencyKey: commandKey("native-review-response-create"),
      })).json();
    }, onSuccess: async () => { setResponseBody(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createTestimonial = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "reputation", objectType: "testimonial", objectKey: `testimonial:${Date.now()}`, title: "Approved customer testimonial", summary: testimonialBody.trim(), classification: "confidential", visibility: "team",
      data: { body: testimonialBody.trim(), consentReference: { reference: testimonialConsent.trim(), status: "verified_for_publication" }, evidenceIds: testimonialEvidenceId ? [testimonialEvidenceId.trim()] : [], operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "testimonial_governance", publication: "not_dispatched" }, evidenceIds: testimonialEvidenceId ? [testimonialEvidenceId.trim()] : [], idempotencyKey: commandKey("native-testimonial-create"),
    })).json(),
    onSuccess: async () => { setTestimonialBody(""); setTestimonialConsent(""); setTestimonialEvidenceId(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createRatingSummary = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "reputation", objectType: "rating_summary", objectKey: `rating-summary:${Date.now()}`, title: "Native EOS rating summary", summary: `${reviews.length} governed review record${reviews.length === 1 ? "" : "s"} included.`, classification: "confidential", visibility: "team",
      data: { sourceReviewObjectIds: reviews.map((review) => review.id), averageRating: Number(averageRating.toFixed(2)), generatedAt: new Date().toISOString(), operatingMode: "native_eos" },
      sourceReference: { authority: "native_eos", capability: "rating_aggregation" }, evidenceIds: [], idempotencyKey: commandKey("native-rating-summary-create"),
    })).json(), onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });
  const transition = useMutation({
    mutationFn: async ({ object, state }: { object: Json; state: "active" | "completed" }) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state, rationale: state === "active" ? "Activate this reviewed native EOS reputation record." : "Complete this governed native EOS reputation record after its evidenced outcome is retained.", evidenceIds: object.evidenceIds || [], idempotencyKey: commandKey(`native-reputation-${state}`),
    })).json(), onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });

  return <Card data-testid="native-reputation-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-primary" />Native Reputation Studio</CardTitle><CardDescription className="mt-1">Request feedback, retain review evidence, prepare approved responses, and govern testimonials inside EOS. External review platforms can reconcile their records later, but they are never required to understand or operate the company’s reputation workflow.</CardDescription></div><Button size="sm" variant="outline" onClick={() => { reputationQuery.refetch(); crmQuery.refetch(); }} disabled={reputationQuery.isFetching || crmQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${(reputationQuery.isFetching || crmQuery.isFetching) ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Reputation command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Send className="h-4 w-4 text-primary" /><h3 className="font-semibold">Consent-aware review request</h3></div><p className="mt-1 text-sm text-muted-foreground">A native request plan creates a governed record. It does not send email, SMS, or a provider message until an approved delivery path exists.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="review-relationship">Relationship</Label><select id="review-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={relationshipId} onChange={(event) => setRelationshipId(event.target.value)}><option value="">Select CRM relationship</option>{relationships.map((relationship: Json) => <option key={relationship.id} value={relationship.id}>{relationship.title}</option>)}</select></div><select className="h-10 rounded-md border bg-background px-3 text-sm" value={requestChannel} onChange={(event) => setRequestChannel(event.target.value)} aria-label="Review request channel"><option value="email">Email</option><option value="sms">SMS</option><option value="in_person">In person</option><option value="other">Other approved channel</option></select><Input value={requestConsent} onChange={(event) => setRequestConsent(event.target.value)} placeholder="Consent reference or evidence ID" aria-label="Review request consent reference" /><Button disabled={!canExecute || !relationshipId || requestConsent.trim().length < 3 || createRequest.isPending} onClick={() => createRequest.mutate()}><Plus className="mr-2 h-4 w-4" />{createRequest.isPending ? "Creating…" : "Create review request"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /><h3 className="font-semibold">Observed review evidence</h3></div><p className="mt-1 text-sm text-muted-foreground">Record a received review with its source reference. EOS does not invent a third-party review or claim it was published elsewhere.</p><div className="mt-4 grid gap-3"><Input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} placeholder="Review label or customer reference" aria-label="Review title" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={reviewRating} onChange={(event) => setReviewRating(event.target.value)} aria-label="Review rating">{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>)}</select><Input value={reviewSource} onChange={(event) => setReviewSource(event.target.value)} placeholder="Source reference, URL, or receipt" aria-label="Review source reference" /><Button variant="outline" disabled={!canExecute || reviewTitle.trim().length < 2 || reviewSource.trim().length < 3 || createReview.isPending} onClick={() => createReview.mutate()}><Plus className="mr-2 h-4 w-4" />{createReview.isPending ? "Recording…" : "Record review"}</Button></div></section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><MessageSquareQuote className="h-4 w-4 text-primary" /><h3 className="font-semibold">Approved response draft</h3></div><p className="mt-1 text-sm text-muted-foreground">Prepare a response tied to the observed review. Activating the record is an approval decision; it still does not publish externally without a separate receipt-backed provider action.</p><div className="mt-4 grid gap-3"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedReview?.id || ""} onChange={(event) => setResponseReviewId(event.target.value)} aria-label="Review for response"><option value="">Select review</option>{reviews.map((review) => <option key={review.id} value={review.id}>{review.title}</option>)}</select><Textarea value={responseBody} onChange={(event) => setResponseBody(event.target.value)} placeholder="Approved response text" aria-label="Review response body" /><Button variant="outline" disabled={!canExecute || !selectedReview || responseBody.trim().length < 3 || !activeSeatId || createResponse.isPending} onClick={() => createResponse.mutate()}><Plus className="mr-2 h-4 w-4" />{createResponse.isPending ? "Drafting…" : "Create response draft"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="font-semibold">Testimonial governance</h3></div><p className="mt-1 text-sm text-muted-foreground">Preserve the consent and supporting evidence before a testimonial can be activated or used in a native site.</p><div className="mt-4 grid gap-3"><Textarea value={testimonialBody} onChange={(event) => setTestimonialBody(event.target.value)} placeholder="Approved testimonial text" aria-label="Testimonial body" /><Input value={testimonialConsent} onChange={(event) => setTestimonialConsent(event.target.value)} placeholder="Consent reference" aria-label="Testimonial consent reference" /><Input value={testimonialEvidenceId} onChange={(event) => setTestimonialEvidenceId(event.target.value)} placeholder="EOS evidence record ID" aria-label="Testimonial evidence ID" /><Button variant="outline" disabled={!canExecute || testimonialBody.trim().length < 3 || testimonialConsent.trim().length < 3 || createTestimonial.isPending} onClick={() => createTestimonial.mutate()}><Plus className="mr-2 h-4 w-4" />{createTestimonial.isPending ? "Creating…" : "Create testimonial record"}</Button></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Native operating view</p><h3 className="mt-1 font-semibold">Reputation evidence board</h3></div><Badge variant="outline">{reviews.length} reviews · {requests.length} requests · {responses.length} responses · {testimonials.length} testimonials · {averageRating ? averageRating.toFixed(1) : "—"} average</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-3">{[...requests, ...reviews, ...responses, ...testimonials].map((object) => <div key={object.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{object.title}</p><p className="mt-1 text-xs text-muted-foreground">{object.objectType.replaceAll("_", " ")} · {object.summary}</p></div><Badge variant={stateVariant(object.state)}>{object.state}</Badge></div>{object.objectType === "review" && <p className="mt-3 text-sm"><Star className="mr-1 inline h-3.5 w-3.5 text-primary" />{object.data?.rating || "—"} / 5</p>}<div className="mt-3 flex flex-wrap gap-2">{object.state === "draft" && <Button size="sm" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object, state: "active" })}>Activate</Button>}{object.state === "active" && <Button size="sm" variant="outline" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object, state: "completed" })}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Complete</Button>}</div></div>)}{!objects.length && <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Create the first request or retain a received review to make reputation visible and controllable inside EOS.</div>}</div><div className="mt-4"><Button size="sm" variant="outline" disabled={!canExecute || !reviews.length || createRatingSummary.isPending} onClick={() => createRatingSummary.mutate()}>{createRatingSummary.isPending ? "Creating…" : "Create governed rating summary"}</Button></div></section>
      <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Native first, provider honest</AlertTitle><AlertDescription>EOS owns the consent-aware request plan, review evidence, response approval, testimonial proof, and rating aggregation. A later provider connector may reconcile or dispatch an explicitly authorized action with a receipt; this studio does not claim an external message was sent or a response was published.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
