import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpenCheck, FileSpreadsheet, Plus, RefreshCw, Save, ShieldCheck, Table2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;
type Row = Record<string, string>;

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

function columnsFromText(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function rowsFrom(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map((row) => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell == null ? "" : String(cell)])))
    : [];
}

function evaluateFormula(value: string, _column: string, rows: Row[]) {
  if (!value.startsWith("=")) return value;
  const match = /^=(SUM|AVERAGE|COUNT)\(([a-zA-Z0-9 _.-]+)\)$/i.exec(value.trim());
  if (!match) return value;
  const values = rows.map((row) => Number(row[match[2].trim()])).filter(Number.isFinite);
  if (match[1].toUpperCase() === "COUNT") return String(values.length);
  if (!values.length) return "0";
  const sum = values.reduce((total, item) => total + item, 0);
  return match[1].toUpperCase() === "AVERAGE" ? String(Math.round((sum / values.length) * 100) / 100) : String(sum);
}

export function NativeSheetsStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [workbookTitle, setWorkbookTitle] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const [sheetTitle, setSheetTitle] = useState("Operating model");
  const [columnsText, setColumnsText] = useState("Item, Owner, Status, Amount");
  const [draftRows, setDraftRows] = useState<Row[]>([]);
  const [chartTitle, setChartTitle] = useState("");
  const [chartColumn, setChartColumn] = useState("");
  const [error, setError] = useState("");

  const query = useQuery<Json>({
    // A role change must not reuse another seat's workbook cache.  The
    // server remains the authority for both tenant and role visibility.
    queryKey: [root, roleScopeKey, "native-sheets"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/sheets`)).json(),
  });
  const objects: Json[] = query.data?.objects || [];
  const workbooks = useMemo(() => objects.filter((item) => item.objectType === "workbook"), [objects]);
  const contextQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-sheets-context"], queryFn: async () => (await apiRequest("GET", `${root}/context`)).json() });
  const canViewCrm = Array.isArray(contextQuery.data?.principalContext?.visibleInstrumentKeys) && contextQuery.data.principalContext.visibleInstrumentKeys.includes("crm");
  const crmQuery = useQuery<Json>({ queryKey: [root, roleScopeKey, "native-sheets-crm-context"], enabled: Boolean(canViewCrm), retry: false, queryFn: async () => (await apiRequest("GET", `${root}/instruments/crm`)).json() });
  const relationshipChoices = useMemo(() => {
    const crmObjects: Json[] = crmQuery.data?.objects || [];
    const people = crmObjects.filter((item) => item.objectType === "person");
    return crmObjects.filter((item) => item.objectType === "relationship").map((relationship) => {
      const person = people.find((item) => item.id === relationship.data?.personObjectId);
      return { relationship, label: `${String(relationship.data?.relationshipType || "Relationship").replaceAll("_", " ")} · ${person?.data?.displayName || person?.title || "Visible relationship"}` };
    });
  }, [crmQuery.data]);
  const selectedRelationship = relationshipChoices.find((item) => item.relationship.id === selectedRelationshipId) || null;
  const selectedWorkbook = workbooks.find((item) => item.id === selectedWorkbookId) || workbooks[0];
  const worksheets = useMemo(() => objects.filter((item) => item.objectType === "worksheet" && (item.parentObjectId === selectedWorkbook?.id || item.data?.workbookObjectId === selectedWorkbook?.id)), [objects, selectedWorkbook?.id]);
  const selectedSheet = selectedSheetId === "__new__" ? undefined : (worksheets.find((item) => item.id === selectedSheetId) || worksheets[0]);
  const charts = useMemo(() => objects.filter((item) => item.objectType === "chart" && (item.parentObjectId === selectedSheet?.id || item.data?.worksheetObjectId === selectedSheet?.id)), [objects, selectedSheet?.id]);
  const sheetColumns = useMemo<string[]>(() => Array.isArray(selectedSheet?.data?.columns) ? (selectedSheet.data.columns as unknown[]).map((column: unknown) => String(column)) : columnsFromText(columnsText), [selectedSheet?.data?.columns, columnsText]);
  const sheetRows = useMemo(() => selectedSheet ? rowsFrom(selectedSheet.data?.rows) : draftRows, [selectedSheet?.data?.rows, selectedSheet?.version, draftRows]);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-sheets"] });

  useEffect(() => {
    if (!selectedSheet) return;
    setSheetTitle(String(selectedSheet.title || ""));
    setColumnsText((selectedSheet.data?.columns || []).map(String).join(", "));
    setDraftRows(rowsFrom(selectedSheet.data?.rows));
  }, [selectedSheet?.id, selectedSheet?.version]);

  const beginNewWorksheet = () => {
    setSelectedSheetId("__new__");
    setSheetTitle("Operating model");
    setColumnsText("Item, Owner, Status, Amount");
    setDraftRows([]);
    setChartTitle("");
    setChartColumn("");
  };

  const createWorkbook = useMutation({
    mutationFn: async () => {
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "sheets", objectType: "workbook", objectKey: `workbook:${safeKey(workbookTitle)}:${Date.now()}`,
        title: workbookTitle.trim(), summary: "Native EOS structured model.", classification: "confidential", visibility: "team",
        data: { worksheets: [] }, sourceReference: { authority: "native_eos", capability: "workbook" }, evidenceIds: [], idempotencyKey: commandKey("sheets-workbook"),
      })).json();
      let relationshipLinked = true;
      if (selectedRelationship) try {
        await apiRequest("POST", `${root}/instrument-links`, {
          sourceObjectId: result.object.id, targetObjectId: selectedRelationship.relationship.id, relationshipType: "concerns_relationship",
          metadata: { relationshipLabel: selectedRelationship.label }, idempotencyKey: commandKey("native-workbook-relationship-link"),
        });
      } catch { relationshipLinked = false; }
      return { ...result, relationshipLinked };
    },
    onSuccess: async (result) => { setSelectedWorkbookId(result.object.id); setWorkbookTitle(""); if (!result.relationshipLinked) setError("The workbook was created, but EOS could not create its CRM relationship link. Review the workbook before relying on that context."); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const createWorksheet = useMutation({
    mutationFn: async () => {
      if (!selectedWorkbook) throw new Error("Create or select a workbook first.");
      const columns = columnsFromText(columnsText);
      if (!columns.length) throw new Error("Add at least one column.");
      const worksheet = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "sheets", objectType: "worksheet", objectKey: `worksheet:${safeKey(sheetTitle)}:${Date.now()}`,
        title: sheetTitle.trim(), summary: `Worksheet in ${selectedWorkbook.title}.`, classification: "confidential", visibility: "team", parentObjectId: selectedWorkbook.id,
        data: { workbookObjectId: selectedWorkbook.id, columns, rows: draftRows }, sourceReference: { authority: "native_eos", capability: "worksheet" }, evidenceIds: [], idempotencyKey: commandKey("sheets-worksheet"),
      })).json();
      const existing = Array.isArray(selectedWorkbook.data?.worksheets) ? selectedWorkbook.data.worksheets : [];
      await apiRequest("PATCH", `${root}/instrument-objects/${selectedWorkbook.id}`, {
        expectedVersion: selectedWorkbook.version, data: { ...selectedWorkbook.data, worksheets: [...existing, worksheet.object.id] }, idempotencyKey: commandKey("sheets-workbook-attach"),
      });
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedWorkbook.id, targetObjectId: worksheet.object.id, relationshipType: "contains_worksheet", metadata: {}, idempotencyKey: commandKey("sheets-link-worksheet") });
      return worksheet;
    },
    onSuccess: async (result) => { setSelectedSheetId(result.object.id); setDraftRows([]); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });
  const saveWorksheet = useMutation({
    mutationFn: async () => {
      if (!selectedSheet) throw new Error("Select a worksheet to save.");
      const columns = columnsFromText(columnsText);
      if (!columns.length) throw new Error("Add at least one column.");
      return (await apiRequest("PATCH", `${root}/instrument-objects/${selectedSheet.id}`, {
        expectedVersion: selectedSheet.version, title: sheetTitle.trim(), data: { ...selectedSheet.data, columns, rows: draftRows }, idempotencyKey: commandKey("sheets-save"),
      })).json();
    },
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version, state: "active", rationale: "Activate this governed native workbook, worksheet, or chart for its recorded operating purpose.", evidenceIds: [], idempotencyKey: commandKey("sheets-activate"),
    })).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const createChart = useMutation({
    mutationFn: async () => {
      if (!selectedSheet) throw new Error("Select a worksheet before creating a chart view.");
      const column = chartColumn.trim();
      if (!sheetColumns.includes(column)) throw new Error("Choose a worksheet column for the chart.");
      const result = await (await apiRequest("POST", `${root}/instrument-objects`, {
        instrumentKey: "sheets", objectType: "chart", objectKey: `chart:${safeKey(chartTitle)}:${Date.now()}`,
        title: chartTitle.trim(), summary: `Bar chart of ${column} from ${selectedSheet.title}.`, classification: "confidential", visibility: "team", parentObjectId: selectedSheet.id,
        data: { worksheetObjectId: selectedSheet.id, chartType: "bar", dataRange: column }, sourceReference: { authority: "native_eos", capability: "worksheet_chart" }, evidenceIds: [], idempotencyKey: commandKey("sheets-chart"),
      })).json();
      await apiRequest("POST", `${root}/instrument-links`, { sourceObjectId: selectedSheet.id, targetObjectId: result.object.id, relationshipType: "visualizes", metadata: { dataRange: column }, idempotencyKey: commandKey("sheets-link-chart") });
      return result;
    },
    onSuccess: async () => { setChartTitle(""); await refresh(); },
    onError: (cause: Error) => setError(cause.message),
  });

  const updateCell = (rowIndex: number, column: string, value: string) => setDraftRows((current) => current.map((row, index) => index === rowIndex ? { ...row, [column]: value } : row));
  const addRow = () => setDraftRows((current) => [...current, Object.fromEntries(columnsFromText(columnsText).map((column) => [column, ""]))]);
  const deleteRow = (rowIndex: number) => setDraftRows((current) => current.filter((_, index) => index !== rowIndex));
  const canBuildSheet = Boolean(selectedWorkbook && sheetTitle.trim().length >= 2 && columnsFromText(columnsText).length);

  return <Card data-testid="native-sheets-studio">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Native Sheets</CardTitle><CardDescription className="mt-1">Build operating models, trackers, forecasts, and chart views directly in EOS. Connected spreadsheet providers can reconcile later; no external spreadsheet product is required to start.</CardDescription></div><Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>Sheet command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4"><section className="rounded-xl border p-3"><div className="flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-primary" /><h3 className="font-semibold">Workbooks</h3></div><div className="mt-3 space-y-2"><Input value={workbookTitle} onChange={(event) => setWorkbookTitle(event.target.value)} placeholder="Revenue model" aria-label="New workbook title" />{canViewCrm && <div><Label htmlFor="native-workbook-relationship" className="text-xs">Relationship context (optional)</Label><select id="native-workbook-relationship" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedRelationshipId} onChange={(event) => setSelectedRelationshipId(event.target.value)} disabled={crmQuery.isFetching}><option value="">No CRM relationship</option>{relationshipChoices.map((choice) => <option key={choice.relationship.id} value={choice.relationship.id}>{choice.label}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Only CRM relationships already visible to this role appear here. EOS records an auditable native relationship edge; no external spreadsheet is changed.</p></div>}<Button size="sm" className="w-full" disabled={!canExecute || workbookTitle.trim().length < 2 || createWorkbook.isPending} onClick={() => createWorkbook.mutate()}><Plus className="mr-2 h-4 w-4" />{createWorkbook.isPending ? "Creating…" : "Create workbook"}</Button></div><div className="mt-3 space-y-2">{workbooks.map((workbook) => <button type="button" key={workbook.id} onClick={() => { setSelectedWorkbookId(workbook.id); setSelectedSheetId(""); }} className={`w-full rounded-lg border p-3 text-left ${selectedWorkbook?.id === workbook.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-2"><span className="text-sm font-medium">{workbook.title}</span><Badge variant={stateVariant(workbook.state)}>{workbook.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{Array.isArray(workbook.data?.worksheets) ? workbook.data.worksheets.length : 0} worksheet(s)</p>{workbook.state === "draft" && <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" disabled={!canDecide || activate.isPending} onClick={(event) => { event.stopPropagation(); activate.mutate(workbook); }}>Activate</Button>}</button>)}{!workbooks.length && <p className="py-3 text-sm text-muted-foreground">Create the first workbook.</p>}</div></section><section className="rounded-xl border p-3"><div className="flex items-center gap-2"><Table2 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Worksheets</h3></div><div className="mt-3 space-y-2">{worksheets.map((sheet) => <button key={sheet.id} type="button" onClick={() => setSelectedSheetId(sheet.id)} className={`w-full rounded-lg border p-3 text-left ${selectedSheet?.id === sheet.id ? "border-primary bg-primary/5" : "bg-muted/30"}`}><div className="flex justify-between gap-2"><span className="text-sm font-medium">{sheet.title}</span><Badge variant={stateVariant(sheet.state)}>{sheet.state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{rowsFrom(sheet.data?.rows).length} rows · {(sheet.data?.columns || []).length} columns</p></button>)}{selectedWorkbook && !worksheets.length && <p className="py-3 text-sm text-muted-foreground">Add the first worksheet below.</p>}</div></section></aside>
        <section className="space-y-5"><section className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eos-label">{selectedSheet ? `Worksheet · version ${selectedSheet.version}` : "New worksheet"}</p><h3 className="mt-1 font-semibold">{selectedSheet ? selectedSheet.title : "Build a native worksheet"}</h3></div>{selectedSheet?.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(selectedSheet)}>Activate worksheet</Button>}</div><div className="mt-4 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><div><Label htmlFor="native-sheet-title">Worksheet name</Label><Input id="native-sheet-title" className="mt-1" value={sheetTitle} onChange={(event) => setSheetTitle(event.target.value)} placeholder="Operating model" /></div><div><Label htmlFor="native-sheet-columns">Columns</Label><Input id="native-sheet-columns" className="mt-1" value={columnsText} onChange={(event) => setColumnsText(event.target.value)} placeholder="Item, Owner, Status, Amount" /></div></div><p className="text-xs text-muted-foreground">Separate columns with commas. Formulas such as <code>=SUM(Amount)</code>, <code>=AVERAGE(Amount)</code>, and <code>=COUNT(Amount)</code> remain stored visibly and show their calculated preview.</p><div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-sm"><thead className="bg-muted/50"><tr>{sheetColumns.map((column) => <th key={column} className="min-w-36 border-b p-2 text-left font-medium">{column}</th>)}<th className="w-12 border-b p-2" /></tr></thead><tbody>{draftRows.map((row, rowIndex) => <tr key={`${rowIndex}:${sheetColumns.join("|")}`} className="border-b last:border-0">{sheetColumns.map((column) => <td key={column} className="p-1"><Input value={row[column] || ""} onChange={(event) => updateCell(rowIndex, column, event.target.value)} placeholder={column} /><p className="mt-1 min-h-3 text-[10px] text-muted-foreground">{row[column]?.startsWith("=") ? `= ${evaluateFormula(row[column], column, draftRows)}` : ""}</p></td>)}<td className="p-1"><Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deleteRow(rowIndex)} aria-label={`Remove row ${rowIndex + 1}`}>×</Button></td></tr>)}{!draftRows.length && <tr><td colSpan={sheetColumns.length + 1} className="p-6 text-center text-sm text-muted-foreground">Add a row to begin the model.</td></tr>}</tbody></table></div><div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="outline" disabled={!canExecute || !sheetColumns.length} onClick={addRow}><Plus className="mr-2 h-4 w-4" />Add row</Button>{selectedSheet ? <Button disabled={!canExecute || !canBuildSheet || saveWorksheet.isPending} onClick={() => saveWorksheet.mutate()}><Save className="mr-2 h-4 w-4" />{saveWorksheet.isPending ? "Saving…" : "Save new version"}</Button> : <Button disabled={!canExecute || !canBuildSheet || createWorksheet.isPending} onClick={() => createWorksheet.mutate()}><Plus className="mr-2 h-4 w-4" />{createWorksheet.isPending ? "Creating…" : "Create worksheet"}</Button>}</div></div></section>{selectedSheet && <section className="rounded-xl border p-4"><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="font-semibold">Chart views</h3></div><p className="mt-1 text-sm text-muted-foreground">A chart is its own governed record tied to this worksheet. It remains a native EOS view even when an external spreadsheet is later connected.</p><div className="mt-3 grid gap-3 md:grid-cols-3"><Input value={chartTitle} onChange={(event) => setChartTitle(event.target.value)} placeholder="Monthly pipeline" aria-label="Chart title" /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={chartColumn} onChange={(event) => setChartColumn(event.target.value)} aria-label="Chart column"><option value="">Choose a column</option>{sheetColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select><Button disabled={!canExecute || chartTitle.trim().length < 2 || !chartColumn || createChart.isPending} onClick={() => createChart.mutate()}>{createChart.isPending ? "Creating…" : "Create chart view"}</Button></div><div className="mt-4 grid gap-3 md:grid-cols-2">{charts.map((chart) => { const column = String(chart.data?.dataRange || ""); const points = sheetRows.map((row) => ({ label: row[sheetColumns[0]] || "Row", value: Number(row[column]) || 0 })); const max = Math.max(1, ...points.map((point) => point.value)); return <div key={chart.id} className="rounded-lg border bg-muted/20 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{chart.title}</p><Badge variant={stateVariant(chart.state)}>{chart.state}</Badge></div><div className="mt-3 space-y-2">{points.slice(0, 8).map((point, index) => <div key={`${point.label}:${index}`} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-2 text-xs"><span className="truncate">{point.label}</span><span className="text-right">{point.value}</span><div className="col-span-2 h-2 overflow-hidden rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.max(0, Math.min(100, (point.value / max) * 100))}%` }} /></div></div>)}</div>{chart.state === "draft" && <Button size="sm" variant="outline" className="mt-3" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(chart)}>Activate chart</Button>}</div>; })}{!charts.length && <p className="text-sm text-muted-foreground">No chart views recorded for this worksheet.</p>}</div></section>}</section>
      </div>
      {selectedWorkbook && <div className="flex justify-end"><Button type="button" variant="outline" disabled={!canExecute} onClick={beginNewWorksheet}><Plus className="mr-2 h-4 w-4" />New worksheet</Button></div>}
      <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Native model, controlled collaboration</AlertTitle><AlertDescription>Workbook, worksheet, and chart changes are versioned, tenant-scoped, and visible only through role policy. External spreadsheet connections can reconcile governed data later; they do not become the required operating system or bypass EOS authority.</AlertDescription></Alert>
    </CardContent>
  </Card>;
}
