import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSignature, Loader2, Mail, MessageSquareText, ShieldCheck, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NATIVE_ESIGN_CONSENT_VERSION } from "@shared/native-esign";
import { NativeEsignSignatureCapture, type SignatureImageCapture, type SignatureMethod } from "@/components/native-esign-signature-capture";
import { NativeEsignComparisonView, type NativeEsignComparison } from "@/components/native-esign-comparison-view";

type SigningField = {
  id: string;
  type: "signature" | "initials" | "text" | "date" | "checkbox";
  label: string;
  required: boolean;
  page: number;
};

type SigningView = {
  envelope: { id: string; subject: string; message: string; state: string; expiresAt: string; assuranceMode: "link" | "email_otp" };
  document: { title: string; version: string; sha256: string; fields: SigningField[] };
  recipient: { roleKey: string; signerName: string; signerEmail: string; state: string; consentVersion: string; identityAssuranceState: string; identityVerifiedAt?: string; comparisonAcknowledged: boolean; comparisonAcknowledgedAt?: string | null };
  comparison: NativeEsignComparison | null;
  negotiation: null | {
    id: string; state: "open" | "resolved" | "withdrawn"; subject: string; resolutionSummary: string; updatedAt: string;
    replacementDocumentVersionId?: string | null; replacementEnvelopeId?: string | null;
    entries: Array<{ id: string; author: string; entryType: string; body: string; requestedChanges: string[]; previousEntrySha256: string; entrySha256: string; createdAt: string }>;
  };
};

type IntegrityProjection = {
  valid: boolean; state: "passed" | "failed" | "unavailable"; verifiedAt: string;
  sourceSha256: string; finalSha256: string; auditSha256: string;
  eventCount: number; auditedEventCount: number; captureCount: number; failureCodes: string[];
};

function tokenFromPath(): string {
  return decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1) || "");
}

async function signingRequest<T>(token: string, path = "", method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/api/eos/native-esign/public/${encodeURIComponent(token)}${path}`, {
    method, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "The signing session could not complete that action.");
  }
  return response.json() as Promise<T>;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function NativeEsignPage() {
  const token = useMemo(tokenFromPath, []);
  const [view, setView] = useState<SigningView | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [recordsAccepted, setRecordsAccepted] = useState(false);
  const [signaturesAccepted, setSignaturesAccepted] = useState(false);
  const [consented, setConsented] = useState(false);
  const [intent, setIntent] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [signatureMethod, setSignatureMethod] = useState<SignatureMethod>("typed");
  const [signatureCapture, setSignatureCapture] = useState<SignatureImageCapture | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [complete, setComplete] = useState<{ envelopeState: string; finalSha256: string; integrity?: IntegrityProjection | null } | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityProjection | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [changeRequest, setChangeRequest] = useState({ subject: "Requested agreement changes", body: "", requestedChanges: "" });
  const [negotiationReply, setNegotiationReply] = useState("");
  const [comparisonAccepted, setComparisonAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    const load = (initial = false) => signingRequest<SigningView>(token).then((payload) => {
      if (!active) return;
      setView(payload); setSignatureName((current) => current || payload.recipient.signerName);
      setConsented(payload.recipient.state === "consented");
      setComparisonAccepted((current) => current || payload.recipient.comparisonAcknowledged);
      setIdentityVerified(payload.recipient.identityAssuranceState === "verified" || payload.envelope.assuranceMode !== "email_otp");
    }).catch((reason) => { if (active && initial) setError(reason.message); }).finally(() => { if (active && initial) setLoading(false); });
    void load(true);
    const interval = window.setInterval(() => void load(false), 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token]);

  async function refreshView() {
    const payload = await signingRequest<SigningView>(token);
    setView(payload);
    setConsented(payload.recipient.state === "consented");
    setComparisonAccepted((current) => current || payload.recipient.comparisonAcknowledged);
    setIdentityVerified(payload.recipient.identityAssuranceState === "verified" || payload.envelope.assuranceMode !== "email_otp");
  }

  const additionalFields = view?.document.fields.filter((field) => ["text", "checkbox"].includes(field.type)) || [];
  const automaticPlacements = view?.document.fields.filter((field) => ["signature", "initials", "date"].includes(field.type)) || [];
  const missingRequired = additionalFields.some((field) => field.required && (field.type === "checkbox" ? fieldValues[field.id] !== true : !String(fieldValues[field.id] || "").trim()));
  const missingSignatureCapture = signatureMethod !== "typed" && !signatureCapture;
  const negotiationOpen = view?.negotiation?.state === "open";

  async function requestOtp() {
    setWorking(true); setError("");
    try { await signingRequest(token, "/otp/request", "POST", {}); setOtpSent(true); }
    catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function verifyOtp() {
    setWorking(true); setError("");
    try { await signingRequest(token, "/otp/verify", "POST", { code: otpCode }); setIdentityVerified(true); }
    catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function recordConsent() {
    setWorking(true); setError("");
    try {
      await signingRequest(token, "/consent", "POST", {
        consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
        electronicRecordsAccepted: recordsAccepted,
        electronicSignaturesAccepted: signaturesAccepted,
        comparisonAcknowledgementSha256: view?.comparison && comparisonAccepted ? view.comparison.comparisonSha256 : undefined,
      });
      setConsented(true);
    } catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function sign() {
    setWorking(true); setError("");
    try {
      const signatureCaptureSha256 = signatureMethod === "typed"
        ? await sha256(`typed\0${signatureName.trim()}`)
        : signatureCapture!.sha256;
      const result = await signingRequest<{ envelopeState: string; finalSha256: string; integrity: IntegrityProjection | null }>(token, "/sign", "POST", {
        consentVersion: NATIVE_ESIGN_CONSENT_VERSION,
        intentToSignConfirmed: intent,
        signatureMethod,
        signatureName,
        signatureCaptureSha256,
        signatureCaptureMimeType: signatureCapture?.mimeType,
        signatureCaptureBase64: signatureCapture?.base64,
        fieldValues,
      });
      setComplete(result);
      setIntegrity(result.integrity);
    } catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function decline() {
    setWorking(true); setError("");
    try {
      await signingRequest(token, "/decline", "POST", { reason: declineReason });
      setComplete({ envelopeState: "declined", finalSha256: "" });
    } catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function requestChanges() {
    setWorking(true); setError("");
    try {
      await signingRequest(token, "/negotiations", "POST", { subject: changeRequest.subject, body: changeRequest.body, requestedChanges: changeRequest.requestedChanges.split("\n").map((item) => item.trim()).filter(Boolean) });
      setRequestingChanges(false); await refreshView();
    } catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function replyToNegotiation() {
    if (!view?.negotiation) return;
    setWorking(true); setError("");
    try {
      await signingRequest(token, `/negotiations/${view.negotiation.id}/entries`, "POST", { body: negotiationReply, requestedChanges: [] });
      setNegotiationReply(""); await refreshView();
    } catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  async function verifyEvidence() {
    setWorking(true); setError("");
    try { setIntegrity(await signingRequest<IntegrityProjection>(token, "/verify")); }
    catch (reason: any) { setError(reason.message); }
    finally { setWorking(false); }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-surface p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading signing session" /></main>;
  if (error && !view) return <main className="grid min-h-screen place-items-center bg-surface p-6"><Alert variant="destructive" className="max-w-xl"><TriangleAlert className="h-4 w-4"/><AlertTitle>Signing session unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></main>;

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><FileSignature className="h-5 w-5"/></span><div><p className="eos-label">EntrepreneurOS secure signing</p><h1 className="text-2xl font-semibold tracking-tight">{view?.envelope.subject}</h1></div></header>
        {error ? <Alert variant="destructive"><TriangleAlert className="h-4 w-4"/><AlertTitle>Action not completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {complete ? <Card><CardHeader><div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-muted text-primary"><CheckCircle2 className="h-6 w-6"/></div><CardTitle>{complete.envelopeState === "declined" ? "Signature declined" : complete.envelopeState === "completed" ? "Document signed" : "Your signature is recorded"}</CardTitle><CardDescription>{complete.envelopeState === "completed" ? "All recipients have completed the envelope. The final document and audit record are now sealed by hash." : complete.envelopeState === "declined" ? "The sender can see that you declined and the stated reason." : "Another recipient must complete before the final document is produced."}</CardDescription></CardHeader>{complete.finalSha256 ? <CardContent className="space-y-4"><p className="text-xs text-muted-foreground">Final document SHA-256</p><code className="block break-all rounded-lg bg-muted p-3 text-xs">{complete.finalSha256}</code>{integrity ? <Alert variant={integrity.valid ? "default" : "destructive"}>{integrity.valid ? <ShieldCheck className="h-4 w-4"/> : <TriangleAlert className="h-4 w-4"/>}<AlertTitle>{integrity.valid ? "Evidence verified" : integrity.state === "unavailable" ? "Verification unavailable" : "Evidence verification failed"}</AlertTitle><AlertDescription>{integrity.valid ? `${integrity.eventCount} chained events, ${integrity.auditedEventCount} sealed audit events, and ${integrity.captureCount} signature captures verified.` : `EOS detected: ${integrity.failureCodes.join(", ").replaceAll("_", " ")}. Contact the sender before relying on this record.`}</AlertDescription></Alert> : null}<div className="flex flex-wrap gap-2"><Button asChild><a href={`/api/eos/native-esign/public/${encodeURIComponent(token)}/completed-document`} download>Download signed document</a></Button><Button variant="outline" onClick={verifyEvidence} disabled={working}>{working ? <Loader2 className="animate-spin"/> : <ShieldCheck/>} Verify signed record</Button></div>{integrity?.valid ? <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p>Source <code>{integrity.sourceSha256.slice(0, 16)}…</code></p><p>Audit <code>{integrity.auditSha256.slice(0, 16)}…</code></p><p className="sm:col-span-2">Verified {new Date(integrity.verifiedAt).toLocaleString()}</p></div> : null}</CardContent> : null}</Card> : <>
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.75fr)]">
            <div className="space-y-6"><Card className="overflow-hidden"><CardHeader><CardTitle>{view?.document.title}</CardTitle><CardDescription>Version {view?.document.version} · SHA-256 {view?.document.sha256.slice(0, 16)}…</CardDescription></CardHeader><CardContent><iframe title="Document to review" src={`/api/eos/native-esign/public/${encodeURIComponent(token)}/document`} className="h-[62vh] min-h-[480px] w-full rounded-lg border bg-white" /></CardContent></Card>{view?.comparison ? <NativeEsignComparisonView comparison={view.comparison}/> : null}</div>
            <div className="space-y-6">
              <Card><CardHeader><CardTitle>Signer</CardTitle><CardDescription>{view?.recipient.roleKey}</CardDescription></CardHeader><CardContent><p className="font-medium">{view?.recipient.signerName}</p><p className="text-sm text-muted-foreground">{view?.recipient.signerEmail}</p><p className="mt-4 text-xs text-muted-foreground">Expires {new Date(view?.envelope.expiresAt || 0).toLocaleString()}</p></CardContent></Card>
              {!identityVerified ? <Card>
                <CardHeader><CardTitle>Verify your email</CardTitle><CardDescription>EOS will send a six-digit code to {view?.recipient.signerEmail}. Verification confirms access to that mailbox; it is not government-ID proofing.</CardDescription></CardHeader>
                <CardContent className="space-y-4">{otpSent ? <><Label htmlFor="otp-code">Verification code</Label><Input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000"/><Button className="w-full" disabled={working || otpCode.length !== 6} onClick={verifyOtp}>{working ? <Loader2 className="animate-spin"/> : <ShieldCheck/>} Verify and continue</Button><Button className="w-full" variant="ghost" disabled={working} onClick={requestOtp}>Send another code</Button></> : <Button className="w-full" disabled={working} onClick={requestOtp}>{working ? <Loader2 className="animate-spin"/> : <Mail/>} Send verification code</Button>}</CardContent>
              </Card> : !consented ? <Card>
                <CardHeader><CardTitle>Electronic consent</CardTitle><CardDescription>Review the document before accepting. You may decline instead of signing.</CardDescription></CardHeader>
                <CardContent className="space-y-4"><label className="flex items-start gap-3 text-sm"><Checkbox checked={recordsAccepted} onCheckedChange={(value) => setRecordsAccepted(value === true)}/><span>I consent to receive and retain this document as an electronic record.</span></label><label className="flex items-start gap-3 text-sm"><Checkbox checked={signaturesAccepted} onCheckedChange={(value) => setSignaturesAccepted(value === true)}/><span>I agree to use an electronic signature for this document.</span></label>{view?.comparison ? <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><Checkbox checked={comparisonAccepted} onCheckedChange={(value) => setComparisonAccepted(value === true)}/><span><strong className="block">I reviewed this replacement comparison.</strong>I acknowledge the exact change receipt identified by <code className="break-all text-xs">{view.comparison.comparisonSha256}</code> before consenting to the replacement agreement.</span></label> : null}<Button className="w-full" disabled={working || negotiationOpen || !recordsAccepted || !signaturesAccepted || Boolean(view?.comparison && !comparisonAccepted)} onClick={recordConsent}>{working ? <Loader2 className="animate-spin"/> : <ShieldCheck/>} Accept and continue</Button></CardContent>
              </Card> : <Card>
                <CardHeader><CardTitle>Sign the document</CardTitle><CardDescription>Choose how your signature appears, confirm your legal name, and make one affirmative signing action.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-sm font-medium">What EOS will place in the PDF</p>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {automaticPlacements.map((field) => <div key={field.id} className="rounded-md bg-background p-2"><span className="font-medium text-foreground">{field.label}</span><span className="block">Page {field.page} · {field.type === "signature" ? "your selected signature" : field.type === "initials" ? "initials derived from your legal signature name" : "UTC signing date"}</span></div>)}
                    </div>
                  </div>
                  {additionalFields.map((field) => field.type === "checkbox" ? <label key={field.id} className="flex items-start gap-3 text-sm"><Checkbox checked={fieldValues[field.id] === true} onCheckedChange={(value) => setFieldValues((current) => ({ ...current, [field.id]: value === true }))}/><span>{field.label}{field.required ? " *" : ""}</span></label> : <div key={field.id} className="space-y-2"><Label htmlFor={field.id}>{field.label}{field.required ? " *" : ""}</Label><Input id={field.id} value={String(fieldValues[field.id] || "")} onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}/></div>)}
                  <div className="space-y-2"><Label htmlFor="signature-name">Your full legal name</Label><Input id="signature-name" autoComplete="name" value={signatureName} onChange={(event) => setSignatureName(event.target.value)}/></div>
                  <NativeEsignSignatureCapture method={signatureMethod} signerName={signatureName} capture={signatureCapture} onMethodChange={(method) => { setSignatureMethod(method); setSignatureCapture(null); }} onCaptureChange={setSignatureCapture} onError={setError}/>
                  <label className="flex items-start gap-3 text-sm"><Checkbox checked={intent} onCheckedChange={(value) => setIntent(value === true)}/><span>I intend to sign this document and adopt the {signatureMethod === "typed" ? "typed name" : signatureMethod === "drawn" ? "drawing" : "uploaded image"} above as my electronic signature.</span></label>
                  <Button className="w-full" disabled={working || negotiationOpen || !intent || signatureName.trim().length < 2 || missingRequired || missingSignatureCapture} onClick={sign}>{working ? <Loader2 className="animate-spin"/> : <FileSignature/>} Sign document</Button>
                  <p className="text-xs text-muted-foreground">Image captures are validated, hashed, and stored privately. Choosing a visual method does not change the identity-assurance level of this envelope.</p>
                </CardContent>
              </Card>}
              <Card><CardHeader><CardTitle>{view?.negotiation ? view.negotiation.subject : "Request changes"}</CardTitle><CardDescription>{view?.negotiation?.state === "open" ? "Signing is paused while you and the sender resolve this governed discussion." : view?.negotiation ? "This discussion is closed. Review the resolution before continuing." : "Ask the sender to review specific changes without signing or declining. The issued document remains immutable."}</CardDescription></CardHeader><CardContent className="space-y-3">{view?.negotiation ? <><div className="space-y-2">{view.negotiation.entries.map((entry) => <div key={entry.id} className="rounded-lg border bg-muted/50 p-3 text-sm"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{entry.author} · {entry.entryType.replaceAll("_", " ")}</span><span>{new Date(entry.createdAt).toLocaleString()}</span></div><p className="mt-2 whitespace-pre-wrap">{entry.body}</p>{entry.requestedChanges.length ? <ul className="mt-2 list-disc pl-5 text-xs">{entry.requestedChanges.map((change) => <li key={change}>{change}</li>)}</ul> : null}<p className="mt-2 font-mono text-[10px] text-muted-foreground">Evidence {entry.entrySha256.slice(0, 16)}…</p></div>)}</div>{view.negotiation.state === "open" ? <><Textarea value={negotiationReply} onChange={(event) => setNegotiationReply(event.target.value)} placeholder="Reply to the sender"/><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={working || negotiationReply.trim().length < 2} onClick={replyToNegotiation}><MessageSquareText className="mr-2 h-4 w-4"/>Send reply</Button><Button variant="ghost" disabled={working} onClick={() => void refreshView()}>Refresh discussion</Button></div></> : <Alert><ShieldCheck className="h-4 w-4"/><AlertTitle>Discussion resolved</AlertTitle><AlertDescription>{view.negotiation.resolutionSummary}{view.negotiation.replacementEnvelopeId ? " The sender created a new envelope; use its new private signing link instead of this one." : ""}</AlertDescription></Alert>}</> : requestingChanges ? <><Input value={changeRequest.subject} onChange={(event) => setChangeRequest((value) => ({ ...value, subject: event.target.value }))} placeholder="Change request subject"/><Textarea value={changeRequest.body} onChange={(event) => setChangeRequest((value) => ({ ...value, body: event.target.value }))} placeholder="Explain the requested changes"/><Textarea value={changeRequest.requestedChanges} onChange={(event) => setChangeRequest((value) => ({ ...value, requestedChanges: event.target.value }))} placeholder="One concrete requested change per line"/><div className="flex gap-2"><Button disabled={working || changeRequest.subject.trim().length < 2 || changeRequest.body.trim().length < 2} onClick={requestChanges}>Send request</Button><Button variant="ghost" onClick={() => setRequestingChanges(false)}>Cancel</Button></div></> : <Button variant="outline" onClick={() => setRequestingChanges(true)}><MessageSquareText className="mr-2 h-4 w-4"/>Request changes</Button>}</CardContent></Card>
              <Card><CardHeader><CardTitle>Decline</CardTitle><CardDescription>Declining closes your signing action and records your reason for the sender.</CardDescription></CardHeader><CardContent className="space-y-3">{declining ? <><Textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Why are you declining?"/><div className="flex gap-2"><Button variant="destructive" disabled={working || declineReason.trim().length < 4} onClick={decline}>Confirm decline</Button><Button variant="ghost" onClick={() => setDeclining(false)}>Cancel</Button></div></> : <Button variant="ghost" onClick={() => setDeclining(true)}>I do not want to sign</Button>}</CardContent></Card>
            </div>
          </section>
          <p className="text-center text-xs text-muted-foreground">Your action records consent, intent, timestamps, minimized device/network fingerprints, and a chained audit hash. It does not claim government-ID verification or a qualified certificate signature.</p>
        </>}
      </div>
    </main>
  );
}
