import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileCheck2, FileUp, RefreshCw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiBinaryRequest, apiDownloadRequest, apiRequest, queryClient } from "@/lib/queryClient";

type Json = Record<string, any>;

function commandKey(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function formatBytes(value: unknown) {
  const bytes = typeof value === "number" ? value : 0;
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function stateTone(state: string) {
  return ["active", "completed"].includes(state) ? "default" as const : "outline" as const;
}

export function NativeFilesStudio({ root, roleScopeKey, canExecute, canDecide }: {
  root: string;
  roleScopeKey: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [classification, setClassification] = useState("confidential");
  const [visibility, setVisibility] = useState("team");
  const [error, setError] = useState("");
  const query = useQuery<Json>({
    queryKey: [root, roleScopeKey, "native-files"],
    queryFn: async () => (await apiRequest("GET", `${root}/instruments/files`)).json(),
  });
  const files = useMemo(
    () => (query.data?.objects || []).filter((object: Json) => object.objectType === "file"),
    [query.data],
  );
  const refresh = async () => queryClient.invalidateQueries({ queryKey: [root, roleScopeKey, "native-files"] });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a supported file to upload.");
      setError("");
      return apiBinaryRequest(`${root}/instruments/files/upload`, file, {
        "Content-Type": file.type,
        "X-EOS-File-Name": file.name,
        "X-EOS-File-Title": title.trim() || file.name,
        "X-EOS-File-Summary": summary.trim(),
        "X-EOS-File-Classification": classification,
        "X-EOS-File-Visibility": visibility,
        "Idempotency-Key": commandKey("native-file-upload"),
      });
    },
    onSuccess: async () => {
      setFile(null); setTitle(""); setSummary("");
      if (input.current) input.current.value = "";
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const activate = useMutation({
    mutationFn: async (object: Json) => (await apiRequest("POST", `${root}/instrument-objects/${object.id}/transitions`, {
      expectedVersion: object.version,
      state: "active",
      rationale: "Activate this scanned EOS-native file for its recorded operating purpose.",
      evidenceIds: [],
      idempotencyKey: commandKey("native-file-activate"),
    })).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const download = async (object: Json) => {
    try {
      setError("");
      const response = await apiDownloadRequest(`${root}/instruments/files/${object.id}/download`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = String(object.data?.fileName || object.title || "eos-file");
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return <Card id="native-files-studio" data-testid="native-files-studio">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />Native Files</CardTitle>
          <CardDescription className="mt-1">Keep operating files inside EOS with immutable custody, role-bound visibility, content verification, and a required malware scan. A connected drive is optional, not required.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      {error && <Alert variant="destructive"><AlertTitle>File command not applied</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <section className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Safe native custody</p><p className="mt-1 text-xs text-muted-foreground">EOS accepts PDF, PNG, JPEG, UTF-8 text, Markdown, CSV, WebM audio, and MP4 audio up to 10 MB. Unsupported office formats stay out until their own safe ingestion policy exists.</p></div></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div><Label htmlFor="native-file-input">File</Label><Input ref={input} id="native-file-input" className="mt-1" type="file" accept="application/pdf,image/png,image/jpeg,text/plain,text/markdown,text/csv,audio/webm,audio/mp4" disabled={!canExecute || upload.isPending} onChange={(event) => { const next = event.target.files?.[0] || null; setFile(next); if (next && !title.trim()) setTitle(next.name); }} /><p className="mt-1 text-xs text-muted-foreground">{file ? `${file.name} · ${formatBytes(file.size)}` : "No file selected"}</p></div>
          <div><Label htmlFor="native-file-title">Title</Label><Input id="native-file-title" className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Q4 recovery operating brief" maxLength={300} /></div>
          <div><Label htmlFor="native-file-classification">Classification</Label><select id="native-file-classification" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={classification} onChange={(event) => setClassification(event.target.value)}><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></div>
          <div><Label htmlFor="native-file-visibility">Visibility</Label><select id="native-file-visibility" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="seat">Seat only</option><option value="team">Team hierarchy</option><option value="organization">Organization</option><option value="portfolio">Portfolio principals</option></select></div>
          <div className="lg:col-span-2"><Label htmlFor="native-file-summary">Operating purpose</Label><Textarea id="native-file-summary" className="mt-1" rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What decision, work packet, or governed process does this file support?" maxLength={5000} /></div>
        </div>
        <Button className="mt-4" disabled={!canExecute || !file || !title.trim() || upload.isPending} onClick={() => upload.mutate()}><FileUp className="mr-2 h-4 w-4" />{upload.isPending ? "Scanning and storing…" : "Scan and store native file"}</Button>
      </section>
      <section className="space-y-3" aria-label="Native file library">
        <div><p className="font-semibold">File library</p><p className="mt-1 text-sm text-muted-foreground">Only files in this role's visibility and classification scope appear here.</p></div>
        <div className="grid gap-3 xl:grid-cols-2">
          {files.map((object: Json) => <div key={object.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{object.title}</p><p className="mt-1 text-xs text-muted-foreground">{object.data?.fileName || "File"} · {formatBytes(object.data?.sizeBytes)} · {object.data?.mimeType || "type unavailable"}</p></div><Badge variant={stateTone(String(object.state))}>{object.state}</Badge></div><p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{object.summary || "No operating purpose recorded."}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">{object.data?.scanState === "clean" ? "scan clean" : "scan unresolved"}</Badge><Badge variant="outline">v{object.version}</Badge><Badge variant="outline">{object.visibility}</Badge></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void download(object)}><Download className="mr-2 h-4 w-4" />Download</Button>{object.state === "draft" && <Button size="sm" variant="outline" disabled={!canDecide || activate.isPending} onClick={() => activate.mutate(object)}>{activate.isPending ? "Activating…" : "Activate"}</Button>}</div></div>)}
        </div>
        {!query.isLoading && !files.length && <div className="rounded-xl border border-dashed p-8 text-center"><FileCheck2 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 font-medium">No native files yet</p><p className="mt-1 text-sm text-muted-foreground">Add the first EOS-owned operating file without needing an external drive.</p></div>}
      </section>
    </CardContent>
  </Card>;
}
