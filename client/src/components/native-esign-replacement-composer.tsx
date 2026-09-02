import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDiff, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type { NativeEsignField, NativeEsignTemplateVariable } from "@shared/native-esign";
import { NativeEsignFieldEditor } from "@/components/native-esign-field-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useRuntimeCapabilities } from "@/hooks/use-runtime-capabilities";
import { encodeNativeEsignFieldSchema, encodeNativeEsignHeader, nativeEsignErrorMessage } from "@/lib/native-esign";
import { apiBinaryRequest, apiRequest } from "@/lib/queryClient";

type SourceDocument = {
  id: string; title: string; documentVersion: string; sourceReference: string; fieldSchema: NativeEsignField[];
  templateVersionId?: string | null; generationSnapshot?: Record<string, unknown>;
};
type SourceEnvelope = { id: string; subject: string; message: string };
type DiffStats = { equalLines: number; insertedLines: number; deletedLines: number; operationCount: number };
type Revision = {
  id: string; title: string; documentVersion: string; sourceSha256: string; revisionEvidenceSha256: string;
  comparison: { comparisonSha256: string; comparisonType: "operator_declared" | "generated_text"; declaredChanges: string[]; diffStats?: DiffStats };
};
type TemplateVersion = { id: string; templateId: string; versionLabel: string; variableSchema: NativeEsignTemplateVariable[]; state: string };
type LibraryView = { templateVersions: TemplateVersion[] };

function futureExpiry(): string {
  const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function snapshotValues(snapshot: Record<string, unknown> | undefined): Record<string, string> {
  const values = snapshot?.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)]));
}

async function json<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body) as Response;
  return response.json() as Promise<T>;
}

export function NativeEsignReplacementComposer({ root, sourceDocument, sourceEnvelope, negotiationId, onCompleted }: { root: string; sourceDocument: SourceDocument; sourceEnvelope: SourceEnvelope; negotiationId: string; onCompleted: (envelopeId: string) => Promise<void> | void }) {
  const { untrustedUploadsEnabled } = useRuntimeCapabilities();
  const { toast } = useToast();
  const canGenerate = Boolean(sourceDocument.templateVersionId);
  const [mode, setMode] = useState<"generated" | "upload">(canGenerate ? "generated" : "upload");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<NativeEsignField[]>([]);
  const [revision, setRevision] = useState<Revision | null>(null);
  const [working, setWorking] = useState<"revision" | "replacement" | "">("");
  const [targetTemplateVersionId, setTargetTemplateVersionId] = useState("");
  const [generationValues, setGenerationValues] = useState<Record<string, string>>(() => snapshotValues(sourceDocument.generationSnapshot));
  const [draft, setDraft] = useState({ title: sourceDocument.title, documentVersion: `${sourceDocument.documentVersion}-revision`, sourceReference: sourceDocument.sourceReference, revisionSummary: "", declaredChanges: "", expiresAt: futureExpiry() });
  const library = useQuery<LibraryView>({ queryKey: [`${root}/native-esign/library`, "replacement"], queryFn: () => json("GET", `${root}/native-esign/library`), enabled: canGenerate });
  const sourceTemplate = library.data?.templateVersions.find((item) => item.id === sourceDocument.templateVersionId);
  const compatibleVersions = useMemo(() => library.data?.templateVersions.filter((item) => item.state === "approved" && item.templateId === sourceTemplate?.templateId) || [], [library.data, sourceTemplate?.templateId]);
  const targetTemplate = compatibleVersions.find((item) => item.id === targetTemplateVersionId) || null;
  const roleOptions = useMemo(() => Array.from(new Set(sourceDocument.fieldSchema.map((field) => field.roleKey))).map((value) => ({ value, label: value.replaceAll("_", " ") })), [sourceDocument.fieldSchema]);
  const changes = draft.declaredChanges.split("\n").map((item) => item.trim()).filter(Boolean);
  const uploadReady = Boolean(file && fields.some((field) => field.required && field.type === "signature") && draft.title.trim().length >= 2 && draft.documentVersion.trim() && draft.sourceReference.trim().length >= 2 && draft.revisionSummary.trim().length >= 8 && changes.length);
  const generatedReady = Boolean(targetTemplate && draft.documentVersion.trim() && draft.revisionSummary.trim().length >= 8 && targetTemplate.variableSchema.every((variable) => !variable.required || (generationValues[variable.key] || "").trim()));

  function chooseMode(next: "generated" | "upload") { setMode(next); setRevision(null); }

  async function registerUploadedRevision() {
    if (!file || !uploadReady) return;
    setWorking("revision");
    try {
      const metadata = { title: draft.title, documentVersion: draft.documentVersion, sourceReference: draft.sourceReference, revisionSummary: draft.revisionSummary, declaredChanges: changes, negotiationId };
      const created = await apiBinaryRequest<Revision>(`${root}/native-esign/documents/${sourceDocument.id}/revisions`, file, { "Content-Type": "application/pdf", "x-eos-field-schema": encodeNativeEsignFieldSchema(fields), "x-eos-revision-metadata": encodeNativeEsignHeader(metadata) });
      setRevision(created);
      toast({ title: "Immutable contract revision registered", description: "EOS preserved the source and target hashes with an operator-declared comparison receipt." });
    } catch (error) { toast({ title: nativeEsignErrorMessage("Revision registration failed", error), variant: "destructive" }); }
    finally { setWorking(""); }
  }

  async function registerGeneratedRevision() {
    if (!targetTemplate || !generatedReady) return;
    setWorking("revision");
    try {
      const created = await json<Revision>("POST", `${root}/native-esign/documents/${sourceDocument.id}/generated-revisions`, { templateVersionId: targetTemplate.id, values: generationValues, documentVersion: draft.documentVersion, revisionSummary: draft.revisionSummary, negotiationId });
      setRevision(created);
      toast({ title: "Exact text comparison sealed", description: "EOS reconstructed the source receipt, generated the approved replacement text, and sealed the machine-computed line diff." });
    } catch (error) { toast({ title: nativeEsignErrorMessage("Generated revision failed", error), variant: "destructive" }); }
    finally { setWorking(""); }
  }

  async function createReplacement() {
    if (!revision) return;
    setWorking("replacement");
    try {
      const response = await apiRequest("POST", `${root}/native-esign/envelopes/${sourceEnvelope.id}/replacement`, { documentVersionId: revision.id, negotiationId, subject: sourceEnvelope.subject, message: sourceEnvelope.message, expiresAt: new Date(draft.expiresAt).toISOString() });
      const payload = await (response as Response).json() as { envelope: { id: string } };
      toast({ title: "Replacement draft created", description: "The superseded envelope and its private signing links are now retired. Review the fresh draft before issuing it." });
      await onCompleted(payload.envelope.id);
    } catch (error) { toast({ title: nativeEsignErrorMessage("Replacement creation failed", error), variant: "destructive" }); }
    finally { setWorking(""); }
  }

  return <details className="rounded-lg border border-primary/30 bg-primary/5 p-3">
    <summary className="cursor-pointer text-sm font-semibold">Create governed replacement</summary>
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canGenerate ? <Button type="button" size="sm" variant={mode === "generated" ? "default" : "outline"} onClick={() => chooseMode("generated")}><Sparkles className="mr-2 h-4 w-4"/>Approved template</Button> : null}
        {untrustedUploadsEnabled ? <Button type="button" size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => chooseMode("upload")}><FileDiff className="mr-2 h-4 w-4"/>Reviewed PDF</Button> : null}
      </div>

      {mode === "generated" ? <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Regenerate from an approved version of the same EOS template. EOS verifies the historical generation receipt and computes an exact text diff; this is not legal interpretation or approval.</p>
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={targetTemplateVersionId} onChange={(event) => { setTargetTemplateVersionId(event.target.value); setRevision(null); }}>
          <option value="">Choose an approved template version</option>
          {compatibleVersions.map((version) => <option key={version.id} value={version.id}>Version {version.versionLabel}</option>)}
        </select>
        {targetTemplate ? <div className="grid gap-2 sm:grid-cols-2">{targetTemplate.variableSchema.map((variable) => <label key={variable.key} className="space-y-1 text-sm font-medium">{variable.label}{variable.required ? " *" : ""}<Input value={generationValues[variable.key] || ""} maxLength={variable.maxLength} onChange={(event) => { setGenerationValues((values) => ({ ...values, [variable.key]: event.target.value })); setRevision(null); }}/></label>)}</div> : null}
        <Input value={draft.documentVersion} onChange={(event) => { setDraft((value) => ({ ...value, documentVersion: event.target.value })); setRevision(null); }} placeholder="Replacement version"/>
        <Textarea value={draft.revisionSummary} onChange={(event) => { setDraft((value) => ({ ...value, revisionSummary: event.target.value })); setRevision(null); }} placeholder="Human-reviewed reason for this revision"/>
        {!revision ? <Button type="button" variant="outline" onClick={registerGeneratedRevision} disabled={!generatedReady || Boolean(working)}>{working === "revision" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}Generate and compare exact text</Button> : null}
      </div> : untrustedUploadsEnabled ? <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Upload the reviewed replacement PDF, place fresh fields, and declare the material changes. EOS never claims an automated legal redline for an uploaded PDF.</p>
        <div className="grid gap-2 sm:grid-cols-2"><Input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Replacement title"/><Input value={draft.documentVersion} onChange={(event) => setDraft((value) => ({ ...value, documentVersion: event.target.value }))} placeholder="Version"/><Input className="sm:col-span-2" value={draft.sourceReference} onChange={(event) => setDraft((value) => ({ ...value, sourceReference: event.target.value }))} placeholder="Counsel or review reference"/></div>
        <Textarea value={draft.revisionSummary} onChange={(event) => setDraft((value) => ({ ...value, revisionSummary: event.target.value }))} placeholder="Human-reviewed revision summary"/>
        <Textarea value={draft.declaredChanges} onChange={(event) => setDraft((value) => ({ ...value, declaredChanges: event.target.value }))} placeholder="One declared change per line"/>
        <Input type="file" accept="application/pdf,.pdf" onChange={(event) => { setFile(event.target.files?.[0] || null); setFields([]); setRevision(null); }}/>
        <NativeEsignFieldEditor file={file} fields={fields} onFieldsChange={setFields} roleOptions={roleOptions}/>
        {!revision ? <Button type="button" variant="outline" onClick={registerUploadedRevision} disabled={!uploadReady || Boolean(working)}>{working === "revision" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <FileDiff className="mr-2 h-4 w-4"/>}Register immutable revision</Button> : null}
      </div> : <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>PDF replacements are unavailable</AlertTitle><AlertDescription>Trusted-source mode permits revisions generated from an approved EOS template. This uploaded source cannot be automatically converted into a governed template; recreate reviewed terms in Library or retain an external document reference.</AlertDescription></Alert>}

      {revision ? <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle className="flex flex-wrap items-center gap-2">Revision and comparison sealed <Badge variant="outline">{revision.comparison.comparisonType === "generated_text" ? "exact generated-text diff" : "operator declared"}</Badge></AlertTitle><AlertDescription><span className="block">Revision Evidence {revision.revisionEvidenceSha256.slice(0, 16)}…</span><span className="block">Comparison {revision.comparison.comparisonSha256.slice(0, 16)}…</span>{revision.comparison.diffStats ? <span className="block">{revision.comparison.diffStats.deletedLines} deleted · {revision.comparison.diffStats.insertedLines} inserted · {revision.comparison.diffStats.equalLines} unchanged lines</span> : null}</AlertDescription></Alert> : null}
      {revision ? <div className="space-y-2"><label className="space-y-1 text-sm font-medium">Replacement expiry<Input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))}/></label><Button type="button" onClick={createReplacement} disabled={Boolean(working)}>{working === "replacement" ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4"/>}Retire old envelope and create draft</Button></div> : null}
    </div>
  </details>;
}
