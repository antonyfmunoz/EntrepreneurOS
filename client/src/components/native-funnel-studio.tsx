import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, Globe2, Plus, RefreshCw } from "lucide-react";
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
  const suffix = globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  return prefix + ":" + suffix;
}
function safeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled";
}
function funnelUrl(funnelId: string) { return window.location.origin + "/f/" + funnelId; }

export function NativeFunnelStudio({ root, canExecute, canDecide }: { root: string; canExecute: boolean; canDecide: boolean }) {
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [supportingCopy, setSupportingCopy] = useState("");
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState("Start here");
  const [captureFormObjectId, setCaptureFormObjectId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageHeadline, setPageHeadline] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const formsQuery = useQuery<Json>({
    queryKey: [root, "native-funnel-forms"],
    queryFn: async () => (await apiRequest("GET", root + "/instruments/forms")).json(),
  });
  const funnelsQuery = useQuery<Json>({
    queryKey: [root, "native-funnels"],
    queryFn: async () => (await apiRequest("GET", root + "/instruments/websites")).json(),
  });
  const publishedForms = useMemo(() => (formsQuery.data?.objects || []).filter((item: Json) => item.objectType === "form" && item.state === "active" && item.data?.publicCapture === true), [formsQuery.data]);
  const funnels = useMemo(() => (funnelsQuery.data?.objects || []).filter((item: Json) => item.objectType === "funnel" && item.data?.publicFunnel === true), [funnelsQuery.data]);
  const sites = useMemo(() => (funnelsQuery.data?.objects || []).filter((item: Json) => item.objectType === "site"), [funnelsQuery.data]);
  const activeSites = useMemo(() => sites.filter((site: Json) => site.state === "active"), [sites]);
  const pages = useMemo(() => (funnelsQuery.data?.objects || []).filter((item: Json) => item.objectType === "page" && item.data?.publicPage === true), [funnelsQuery.data]);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [root, "native-funnel-forms"] }),
      queryClient.invalidateQueries({ queryKey: [root, "native-funnels"] }),
    ]);
  };
  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", root + "/instrument-objects", {
      instrumentKey: "websites", objectType: "funnel", objectKey: "funnel:" + safeKey(title) + ":" + Date.now(),
      title: title.trim(), summary: supportingCopy.trim(), classification: "confidential", visibility: "organization",
      data: { publicFunnel: true, headline: headline.trim(), supportingCopy: supportingCopy.trim(), primaryCtaLabel: primaryCtaLabel.trim(), captureFormObjectId },
      sourceReference: { authority: "native_eos", capability: "native_website_funnel" },
      evidenceIds: [], idempotencyKey: commandKey("native-funnel-create"),
    })).json(),
    onSuccess: async () => {
      setTitle(""); setHeadline(""); setSupportingCopy(""); setPrimaryCtaLabel("Start here"); setCaptureFormObjectId("");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (funnel: Json) => (await apiRequest("POST", root + "/instrument-objects/" + funnel.id + "/transitions", {
      expectedVersion: funnel.version, state: "active",
      rationale: "Publish this native EOS funnel so approved public copy routes visitors to an active consented EOS lead-capture form.",
      evidenceIds: [], idempotencyKey: commandKey("native-funnel-publish"),
    })).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const createSite = useMutation({ mutationFn: async () => (await apiRequest("POST", root + "/instrument-objects", { instrumentKey: "websites", objectType: "site", objectKey: "site:" + safeKey(siteName) + ":" + Date.now(), title: siteName.trim(), summary: "EOS-owned native website", classification: "confidential", visibility: "organization", data: { brandName: siteName.trim() }, sourceReference: { authority: "native_eos", capability: "native_website" }, evidenceIds: [], idempotencyKey: commandKey("native-site-create") })).json(), onSuccess: async () => { setSiteName(""); await refresh(); }, onError: (cause: Error) => setError(cause.message) });
  const createPage = useMutation({ mutationFn: async () => { const site = activeSites[0]; if (!site) throw new Error("Create and publish an EOS site before adding a public page."); return (await apiRequest("POST", root + "/instrument-objects", { instrumentKey: "websites", objectType: "page", objectKey: "page:" + safeKey(pageTitle) + ":" + Date.now(), title: pageTitle.trim(), summary: pageHeadline.trim(), classification: "confidential", visibility: "organization", data: { publicPage: true, siteObjectId: site.id, headline: pageHeadline.trim(), supportingCopy: "", primaryCtaLabel: "", primaryCtaHref: "", path: "/" + safeKey(pageTitle) }, sourceReference: { authority: "native_eos", capability: "native_website_page" }, evidenceIds: [], idempotencyKey: commandKey("native-page-create") })).json(); }, onSuccess: async () => { setPageTitle(""); setPageHeadline(""); await refresh(); }, onError: (cause: Error) => setError(cause.message) });
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied((current) => current === url ? "" : current), 1_800);
    } catch { setError("Copy was unavailable in this browser. Select the link and copy it manually."); }
  };

  return <Card data-testid="native-funnel-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" />Native Funnel Studio</CardTitle><CardDescription className="mt-1">Publish EOS-owned landing pages that route visitors into a native consented intake point and then into EOS CRM. No external website, funnel, or CRM subscription is required.</CardDescription></div><Button size="sm" variant="outline" onClick={() => { formsQuery.refetch(); funnelsQuery.refetch(); }} disabled={formsQuery.isFetching || funnelsQuery.isFetching}><RefreshCw className={"mr-2 h-4 w-4 " + (formsQuery.isFetching || funnelsQuery.isFetching ? "animate-spin" : "")} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Funnel command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Native website</h3></div><p className="mt-1 text-sm text-muted-foreground">Create an EOS-owned site and public pages first; funnels remain a specialized conversion path inside the same native web surface.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div><Label htmlFor="site-name">Site / brand name</Label><Input id="site-name" className="mt-1" value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="Empyrean Studios" /><Button className="mt-2" size="sm" disabled={!canExecute || siteName.trim().length < 2 || createSite.isPending} onClick={() => createSite.mutate()}>{createSite.isPending ? "Creating…" : "Create native site"}</Button>{sites.filter((site: Json) => site.state === "draft").map((site: Json) => <Button key={site.id} className="ml-2 mt-2" size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(site)}>Publish {site.title}</Button>)}</div><div><Label htmlFor="site-page-title">First public page</Label><Input id="site-page-title" className="mt-1" value={pageTitle} onChange={(event) => setPageTitle(event.target.value)} placeholder="Revenue Recovery" /><Input className="mt-2" value={pageHeadline} onChange={(event) => setPageHeadline(event.target.value)} placeholder="Public headline" aria-label="Public page headline" /><Button className="mt-2" size="sm" disabled={!canExecute || !activeSites.length || pageTitle.trim().length < 2 || pageHeadline.trim().length < 2 || createPage.isPending} onClick={() => createPage.mutate()}>{createPage.isPending ? "Creating…" : "Create draft page"}</Button></div></div>{pages.map((page: Json) => <div key={page.id} className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm"><span>{page.title} · {page.state}</span>{page.state === "draft" ? <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(page)}>Publish page</Button> : <Button size="sm" variant="outline" asChild><a href={window.location.origin + "/p/" + page.id} target="_blank" rel="noreferrer">Open page</a></Button>}</div>)}</section>
      <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Create an EOS-owned funnel</h3></div><p className="mt-1 text-sm text-muted-foreground">A public funnel can only route to an already-published native form. That keeps public intent, consent, and CRM intake connected without relying on GoHighLevel or another page builder.</p>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="funnel-title">Internal funnel name</Label><Input id="funnel-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Revenue recovery offer" /></div><div><Label htmlFor="funnel-cta">Primary button</Label><Input id="funnel-cta" className="mt-1" value={primaryCtaLabel} onChange={(event) => setPrimaryCtaLabel(event.target.value)} placeholder="Start here" /></div></div>
          <div><Label htmlFor="funnel-headline">Public headline</Label><Input id="funnel-headline" className="mt-1" value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Recover revenue your business has already earned." /></div>
          <div><Label htmlFor="funnel-copy">Supporting copy</Label><Textarea id="funnel-copy" className="mt-1 min-h-24" value={supportingCopy} onChange={(event) => setSupportingCopy(event.target.value)} placeholder="Explain the outcome, who it is for, and what happens after the visitor starts." /></div>
          <div><Label htmlFor="funnel-form">Published native intake point</Label><select id="funnel-form" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={captureFormObjectId} onChange={(event) => setCaptureFormObjectId(event.target.value)}><option value="">Choose a published native form</option>{publishedForms.map((form: Json) => <option key={form.id} value={form.id}>{form.title}</option>)}</select>{!publishedForms.length && <p className="mt-2 text-sm text-amber-700">Publish a native form in Lead Capture Studio first. EOS will not publish a funnel with nowhere governed to send the visitor.</p>}</div>
          <Button disabled={!canExecute || title.trim().length < 2 || headline.trim().length < 2 || primaryCtaLabel.trim().length < 2 || !captureFormObjectId || create.isPending} onClick={() => create.mutate()}><Plus className="mr-2 h-4 w-4" />{create.isPending ? "Creating funnel…" : "Create native funnel"}</Button>
        </div>
      </section>
      <section className="space-y-3"><div><p className="eos-label">Published and draft pages</p><h3 className="mt-1 font-semibold">Your EOS-owned funnel links</h3></div>{funnels.map((funnel: Json) => { const url = funnelUrl(funnel.id); const linkedForm = publishedForms.find((form: Json) => form.id === funnel.data?.captureFormObjectId); return <div key={funnel.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-medium">{funnel.title}</span><Badge variant={funnel.state === "active" ? "default" : "outline"}>{funnel.state}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{funnel.data?.headline || "No public headline recorded."}{linkedForm ? " · Routes to " + linkedForm.title : " · Intake point is unavailable"}</p></div>{funnel.state === "draft" && <Button size="sm" disabled={!canDecide || !linkedForm || activate.isPending} onClick={() => activate.mutate(funnel)}>{activate.isPending ? "Publishing…" : "Publish native funnel"}</Button>}</div>{funnel.state === "active" && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input readOnly value={url} aria-label={funnel.title + " public funnel link"} /><Button variant="outline" size="sm" onClick={() => copy(url)}><Copy className="mr-2 h-4 w-4" />{copied === url ? "Copied" : "Copy link"}</Button><Button variant="outline" size="sm" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></Button></div>}</div>; })}{!funnels.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No native EOS funnels yet. Create one above; it stays a draft until a role with decision authority publishes it.</p>}</section>
      <Alert><AlertTitle>Native first, overlay ready</AlertTitle><AlertDescription>This is the owned EOS front door. A future website or CRM integration may reconcile imported pages and demand into the same governed model, but the funnel itself, consented form, and resulting CRM records remain usable with no provider connected.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
