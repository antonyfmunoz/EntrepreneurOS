import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Search, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Row = Record<string, any>;
const commandKey = (prefix: string) => `${prefix}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;

/** A native, authority-filtered search surface. Results come from the same
 * instrument endpoint as every governed tool and never query an external
 * provider or bypass row visibility. */
export function NativeSearchStudio({ root, canExecute }: { root: string; canExecute: boolean }) {
  const cache = useQueryClient();
  const query = useQuery<Row>({ queryKey: [root, "native-search"], queryFn: async () => (await apiRequest("GET", `${root}/instruments`)).json() });
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [savedName, setSavedName] = useState("");
  const [error, setError] = useState("");
  const allowed = new Set<string>(query.data?.permittedInstrumentKeys || []);
  const resultSet = useMemo(() => (query.data?.objects || []).filter((item: Row) => {
    if (filter !== "all" && item.instrumentKey !== filter) return false;
    const needle = term.trim().toLowerCase();
    return !needle || `${item.title} ${item.summary} ${item.objectKey} ${JSON.stringify(item.data || {})}`.toLowerCase().includes(needle);
  }).slice(0, 100), [query.data, term, filter]);
  const saved = (query.data?.objects || []).filter((item: Row) => item.instrumentKey === "search" && item.objectType === "saved_search");
  const save = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${root}/instrument-objects`, {
      instrumentKey: "search", objectType: "saved_search", objectKey: `search:${savedName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${Date.now()}`,
      title: savedName.trim(), summary: `Native search for ${term.trim() || "all role-visible records"}.`, classification: "confidential", visibility: "seat",
      data: { query: term.trim(), instrumentKey: filter === "all" ? null : filter, resultObjectIds: resultSet.map((item: Row) => item.id) }, sourceReference: { authority: "native_eos" }, evidenceIds: [], idempotencyKey: commandKey("search-save"),
    })).json(),
    onSuccess: async () => { setSavedName(""); await cache.invalidateQueries({ queryKey: [root, "native-search"] }); },
    onError: (cause: Error) => setError(cause.message),
  });
  return <Card data-testid="native-search-studio"><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary"/>Native Search</CardTitle><CardDescription>Discover only the records your compiled role contract can see across EOS. Search never sends company data to an external provider.</CardDescription></CardHeader><CardContent className="space-y-4">{error && <Alert variant="destructive"><AlertTitle>Search command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}<div className="grid gap-3 md:grid-cols-[1fr_220px]"><Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search native company records" aria-label="Search native company records"/><select className="h-10 rounded-md border bg-background px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter native search"><option value="all">All authorized tools</option>{Array.from(allowed).filter((key) => key !== "search").map((key) => <option key={key} value={key}>{key.replaceAll("_", " ")}</option>)}</select></div><div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-3"><ShieldCheck className="h-4 w-4 text-primary"/><span className="text-sm">{resultSet.length} authorized result{resultSet.length === 1 ? "" : "s"}</span><Input className="ml-auto min-w-52 flex-1 sm:max-w-72" value={savedName} onChange={(event) => setSavedName(event.target.value)} placeholder="Save this search"/><Button size="sm" variant="outline" disabled={!canExecute || savedName.trim().length < 3 || save.isPending} onClick={() => save.mutate()}><BookmarkPlus className="mr-2 h-4 w-4"/>Save</Button></div><div className="space-y-2">{resultSet.map((item: Row) => <div key={item.id} className="rounded-xl border p-3"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.instrumentKey.replaceAll("_", " ")}</Badge><Badge variant="outline">{item.state}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary || item.data?.body || item.objectKey}</p></div>)}{!resultSet.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No authorized native records match this search.</p>}</div>{saved.length > 0 && <div className="border-t pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved searches</p><div className="mt-2 flex flex-wrap gap-2">{saved.map((item: Row) => <Button key={item.id} size="sm" variant="outline" onClick={() => { setTerm(String(item.data?.query || "")); setFilter(String(item.data?.instrumentKey || "all")); }}>{item.title}</Button>)}</div></div>}<Alert><AlertTitle>Source and freshness boundary</AlertTitle><AlertDescription>Results are EOS-native records and their stored metadata. Connected providers remain separately authoritative until a provider-specific field adapter is qualified.</AlertDescription></Alert></CardContent></Card>;
}
