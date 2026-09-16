import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, FileBarChart, Gauge, LayoutDashboard, Plus, RefreshCw } from "lucide-react";
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
function stateVariant(state: string) { return state === "active" || state === "completed" ? "default" as const : "outline" as const; }

/**
 * Native analytics is deliberately a governed operating surface, not a chart
 * renderer that silently treats external exports as fact. A metric names its
 * formula and source records; an observation retains a captured value and
 * provenance; dashboards and reports reference those governed metrics.
 */
export function NativeAnalyticsStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string; roleScopeKey: string; canExecute: boolean; canDecide: boolean;
}) {
  const [metricName, setMetricName] = useState("");
  const [metricDefinition, setMetricDefinition] = useState("");
  const [metricFormula, setMetricFormula] = useState("");
  const [metricSources, setMetricSources] = useState("");
  const [observationMetricId, setObservationMetricId] = useState("");
  const [observationValue, setObservationValue] = useState("");
  const [observationSource, setObservationSource] = useState("native_eos");
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardMetricIds, setDashboardMetricIds] = useState<string[]>([]);
  const [reportName, setReportName] = useState("");
  const [reportMetricIds, setReportMetricIds] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [error, setError] = useState("");
  const analyticsQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-analytics"], queryFn: async () => (await apiRequest("GET", `${root}/instruments/analytics`)).json() });
  const objects: Json[] = analyticsQuery.data?.objects || [];
  const metrics = useMemo(() => objects.filter((item: Json) => item.objectType === "metric"), [objects]);
  const observations = useMemo(() => objects.filter((item: Json) => item.objectType === "observation"), [objects]);
  const dashboards = useMemo(() => objects.filter((item: Json) => item.objectType === "dashboard"), [objects]);
  const reports = useMemo(() => objects.filter((item: Json) => item.objectType === "report"), [objects]);
  const selectedMetric = metrics.find((item) => item.id === observationMetricId) || metrics[0];
  const latestObservationByMetric = useMemo(() => new Map(metrics.map((metric) => [metric.id, observations.filter((observation) => observation.data?.metricObjectId === metric.id).sort((a, b) => String(b.data?.observedAt || b.updatedAt).localeCompare(String(a.data?.observedAt || a.updatedAt)))[0]])), [metrics, observations]);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-analytics"] });
  const chooseMetric = (metricId: string, selected: string[], setSelected: (values: string[]) => void) => setSelected(selected.includes(metricId) ? selected.filter((id) => id !== metricId) : [...selected, metricId]);
  const sourceObjectIds = () => metricSources.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

  const createMetric = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "analytics", objectType: "metric", objectKey: `metric:${safeKey(metricName)}:${Date.now()}`, title: metricName.trim(), summary: metricDefinition.trim(), classification: "confidential", visibility: "organization",
      data: { definition: metricDefinition.trim(), formula: metricFormula.trim(), sourceObjectIds: sourceObjectIds(), operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "metric_definition", externalData: "not_asserted" }, evidenceIds: [], idempotencyKey: commandKey("native-analytics-metric-create"),
    })).json(),
    onSuccess: async (result) => { setObservationMetricId(result.object.id); setMetricName(""); setMetricDefinition(""); setMetricFormula(""); setMetricSources(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createObservation = useMutation({
    mutationFn: async () => {
      if (!selectedMetric) throw new Error("Create or select a metric first.");
      return (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "analytics", objectType: "observation", objectKey: `observation:${safeKey(selectedMetric.title)}:${Date.now()}`, title: `${selectedMetric.title} observation`, summary: `Captured value ${Number(observationValue)} for ${selectedMetric.title}.`, classification: "confidential", visibility: "organization", parentObjectId: selectedMetric.id,
        data: { metricObjectId: selectedMetric.id, value: Number(observationValue), observedAt: new Date().toISOString(), sourceMode: observationSource, operatingMode: "native_eos" }, sourceReference: { authority: observationSource === "native_eos" ? "native_eos" : "declared_external_source", capability: "metric_observation", reconciliation: observationSource === "native_eos" ? "not_required" : "pending_receipt" }, evidenceIds: [], idempotencyKey: commandKey("native-analytics-observation-create"),
      })).json();
    }, onSuccess: async () => { setObservationValue(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createDashboard = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "analytics", objectType: "dashboard", objectKey: `dashboard:${safeKey(dashboardName)}:${Date.now()}`, title: dashboardName.trim(), summary: "Native EOS governed metric view.", classification: "confidential", visibility: "organization",
      data: { metricObjectIds: dashboardMetricIds, operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "metric_dashboard" }, evidenceIds: [], idempotencyKey: commandKey("native-analytics-dashboard-create"),
    })).json(), onSuccess: async () => { setDashboardName(""); setDashboardMetricIds([]); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const createReport = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "analytics", objectType: "report", objectKey: `report:${safeKey(reportName)}:${Date.now()}`, title: reportName.trim(), summary: "Native EOS governed operating report.", classification: "confidential", visibility: "organization",
      data: { periodStart: new Date(periodStart).toISOString(), periodEnd: new Date(periodEnd).toISOString(), metricObjectIds: reportMetricIds, operatingMode: "native_eos" }, sourceReference: { authority: "native_eos", capability: "operating_report", externalData: "not_asserted" }, evidenceIds: [], idempotencyKey: commandKey("native-analytics-report-create"),
    })).json(), onSuccess: async () => { setReportName(""); setReportMetricIds([]); setPeriodStart(""); setPeriodEnd(""); await refresh(); }, onError: (cause: Error) => setError(cause.message),
  });
  const transition = useMutation({
    mutationFn: async ({ object, state }: { object: Json; state: "active" | "completed" }) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state, rationale: state === "active" ? "Activate this reviewed native EOS analytics record." : "Complete this governed analytics record after the covered operating period has closed.", evidenceIds: object.evidenceIds || [], idempotencyKey: commandKey(`native-analytics-${state}`),
    })).json(), onSuccess: refresh, onError: (cause: Error) => setError(cause.message),
  });

  return <Card data-testid="native-analytics-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Native Analytics & Intelligence</CardTitle><CardDescription className="mt-1">Define the metrics that matter, capture accountable observations, and compose dashboards and reports inside EOS. Connected providers may reconcile a declared external source, but native operation never depends on them.</CardDescription></div><Button size="sm" variant="outline" onClick={() => analyticsQuery.refetch()} disabled={analyticsQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${analyticsQuery.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Analytics command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" /><h3 className="font-semibold">Governed metric definition</h3></div><p className="mt-1 text-sm text-muted-foreground">Name the decision metric, define the calculation, and identify the EOS records it uses. This is a metric contract, not a guessed chart.</p><div className="mt-4 grid gap-3"><Input value={metricName} onChange={(event) => setMetricName(event.target.value)} placeholder="Metric name, e.g. qualified pipeline" aria-label="Metric name" /><Textarea value={metricDefinition} onChange={(event) => setMetricDefinition(event.target.value)} placeholder="What decision does this metric support?" aria-label="Metric definition" /><Input value={metricFormula} onChange={(event) => setMetricFormula(event.target.value)} placeholder="Formula, e.g. sum(active opportunity amounts)" aria-label="Metric formula" /><Textarea value={metricSources} onChange={(event) => setMetricSources(event.target.value)} placeholder="EOS source record IDs, comma-separated" aria-label="Metric source record IDs" /><Button disabled={!canExecute || metricName.trim().length < 2 || metricDefinition.trim().length < 3 || metricFormula.trim().length < 3 || !sourceObjectIds().length || createMetric.isPending} onClick={() => createMetric.mutate()}><Plus className="mr-2 h-4 w-4" />{createMetric.isPending ? "Creating…" : "Create metric"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Accountable observation</h3></div><p className="mt-1 text-sm text-muted-foreground">Capture an observed value against a defined metric. External-origin data stays explicitly marked as awaiting reconciliation rather than being treated as provider truth.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="observation-metric">Metric</Label><select id="observation-metric" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedMetric?.id || ""} onChange={(event) => setObservationMetricId(event.target.value)}><option value="">Select metric</option>{metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.title}</option>)}</select></div><Input type="number" value={observationValue} onChange={(event) => setObservationValue(event.target.value)} placeholder="Observed value" aria-label="Observed value" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={observationSource} onChange={(event) => setObservationSource(event.target.value)} aria-label="Observation source mode"><option value="native_eos">Native EOS record</option><option value="external_overlay">External overlay pending reconciliation</option></select><Button variant="outline" disabled={!canExecute || !selectedMetric || !observationValue.trim() || !Number.isFinite(Number(observationValue)) || createObservation.isPending} onClick={() => createObservation.mutate()}><Plus className="mr-2 h-4 w-4" />{createObservation.isPending ? "Capturing…" : "Capture observation"}</Button></div></section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><LayoutDashboard className="h-4 w-4 text-primary" /><h3 className="font-semibold">Decision dashboard</h3></div><p className="mt-1 text-sm text-muted-foreground">Compose a role-appropriate native view from governed metrics. The dashboard inherits each metric’s company boundary and record trail.</p><div className="mt-4 grid gap-3"><Input value={dashboardName} onChange={(event) => setDashboardName(event.target.value)} placeholder="Dashboard name" aria-label="Dashboard name" /><div className="grid gap-2 sm:grid-cols-2">{metrics.map((metric) => <label key={metric.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={dashboardMetricIds.includes(metric.id)} onChange={() => chooseMetric(metric.id, dashboardMetricIds, setDashboardMetricIds)} />{metric.title}</label>)}{!metrics.length && <p className="text-sm text-muted-foreground">Create a metric first.</p>}</div><Button variant="outline" disabled={!canExecute || dashboardName.trim().length < 2 || !dashboardMetricIds.length || createDashboard.isPending} onClick={() => createDashboard.mutate()}><Plus className="mr-2 h-4 w-4" />{createDashboard.isPending ? "Creating…" : "Create dashboard"}</Button></div></section>
        <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><FileBarChart className="h-4 w-4 text-primary" /><h3 className="font-semibold">Operating report</h3></div><p className="mt-1 text-sm text-muted-foreground">Close a defined operating period around selected metrics. Activating a report is an approval; it never asserts external source reconciliation that has not happened.</p><div className="mt-4 grid gap-3"><Input value={reportName} onChange={(event) => setReportName(event.target.value)} placeholder="Report name" aria-label="Report name" /><div className="grid grid-cols-2 gap-2"><Input type="datetime-local" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} aria-label="Report period start" /><Input type="datetime-local" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} aria-label="Report period end" /></div><div className="grid gap-2 sm:grid-cols-2">{metrics.map((metric) => <label key={metric.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={reportMetricIds.includes(metric.id)} onChange={() => chooseMetric(metric.id, reportMetricIds, setReportMetricIds)} />{metric.title}</label>)}</div><Button variant="outline" disabled={!canExecute || reportName.trim().length < 2 || !periodStart || !periodEnd || new Date(periodEnd) <= new Date(periodStart) || !reportMetricIds.length || createReport.isPending} onClick={() => createReport.mutate()}><Plus className="mr-2 h-4 w-4" />{createReport.isPending ? "Creating…" : "Create report"}</Button></div></section>
      </div>
      <section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">Native operating view</p><h3 className="mt-1 font-semibold">Decision intelligence board</h3></div><Badge variant="outline">{metrics.length} metrics · {observations.length} observations · {dashboards.length} dashboards · {reports.length} reports</Badge></div><div className="mt-4 grid gap-3 xl:grid-cols-3">{metrics.map((metric) => { const observation = latestObservationByMetric.get(metric.id); return <div key={metric.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{metric.title}</p><p className="mt-1 text-xs text-muted-foreground">{metric.data?.formula}</p></div><Badge variant={stateVariant(metric.state)}>{metric.state}</Badge></div><p className="mt-4 text-2xl font-semibold">{observation ? observation.data?.value : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{observation ? `${observation.data?.sourceMode === "external_overlay" ? "External overlay pending reconciliation" : "Native EOS observation"} · ${new Date(observation.data?.observedAt).toLocaleString()}` : "No observation yet."}</p>{metric.state === "draft" && <Button size="sm" className="mt-3" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object: metric, state: "active" })}>Activate metric</Button>}</div>})}{!metrics.length && <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Create a metric to make the company’s operating signals visible and controllable inside EOS.</div>}</div><div className="mt-4 grid gap-3 xl:grid-cols-2">{[...dashboards, ...reports].map((object) => <div key={object.id} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{object.title}</p><p className="mt-1 text-xs text-muted-foreground">{object.objectType} · {(object.data?.metricObjectIds || []).length} metric{(object.data?.metricObjectIds || []).length === 1 ? "" : "s"}</p></div><Badge variant={stateVariant(object.state)}>{object.state}</Badge></div>{object.state === "draft" && <Button size="sm" className="mt-3" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object, state: "active" })}>Activate</Button>}{object.state === "active" && object.objectType === "report" && <Button size="sm" variant="outline" className="mt-3" disabled={!canDecide || transition.isPending} onClick={() => transition.mutate({ object, state: "completed" })}>Close report</Button>}</div>)}</div></section>
      <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>Native first, source honest</AlertTitle><AlertDescription>EOS owns the metric contract, observation, dashboard, and operating report. A future connected provider can reconcile a declared source with a receipt, but this studio never invents an external value, a provider refresh, or a completed reconciliation.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
