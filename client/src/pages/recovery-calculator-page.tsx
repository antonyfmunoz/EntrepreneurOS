import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Check, ChevronRight, LockKeyhole, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import type { RecoveryCalculatorInput, RecoveryResult } from "@shared/recovery-calculator";

type Projection = {
  session: { status: string; inputRevision: number; expiresAt: string };
  partialResult: null | {
    assumptionVersion: string; score: number; fit: RecoveryResult["fit"]; route: RecoveryResult["route"];
    range: RecoveryResult["range"]; dominantOpportunity: { key: string; label: string; base: number };
    confidence: string; disclaimer: string;
  };
  fullReport: RecoveryResult | null;
  contactCaptured: boolean;
  route: null | { key: string; calendarUrl: string | null; calendarState: string; message: string };
};

const initialInputs: RecoveryCalculatorInput = {
  profile: { industry: "Roofing", teamSize: 5, serviceArea: "", },
  demand: { monthlyInboundLeads: 40, missedOrUnansweredPercent: 20, averageResponseMinutes: 30, leadToEstimatePercent: 55 },
  estimates: { openEstimates: 20, averageJobValue: 12000, currentClosePercent: 30, staleEstimatePercent: 45 },
  customers: { pastCustomers: 400, annualReactivationPercent: 3 },
  readiness: { dataQuality: "partial", followUpOwnership: "shared", deliveryCapacity: "available", intent: "this_quarter" },
};

const steps = ["Business", "Demand", "Economics", "Readiness"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const requestedCompanyId = Number(new URLSearchParams(window.location.search).get("companyId"));
const recoveryCompanyId = Number.isInteger(requestedCompanyId) && requestedCompanyId > 0 ? requestedCompanyId : undefined;
const recoveryStorageKey = `eos.recovery-calculator.session.v1${recoveryCompanyId ? `.${recoveryCompanyId}` : ""}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "The request could not be completed.");
  return body as T;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-foreground">{label}</span>{children}{hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}</label>;
}

const inputClass = "h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";
const selectClass = `${inputClass} appearance-none`;

export default function RecoveryCalculatorPage() {
  const [token, setToken] = useState("");
  const [projection, setProjection] = useState<Projection | null>(null);
  const [inputs, setInputs] = useState<RecoveryCalculatorInput>(initialInputs);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"calculator" | "partial" | "contact" | "report">("calculator");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [contact, setContact] = useState({ firstName: "", workEmail: "", companyName: "", phone: "", communicationPreference: "email", consent: false });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = sessionStorage.getItem(recoveryStorageKey);
        if (existing) {
          try {
            const restored = await api<Projection>(`/api/eos/recovery-calculator/${encodeURIComponent(existing)}`);
            if (!active) return;
            setToken(existing); setProjection(restored);
            setMode(restored.contactCaptured ? "report" : restored.partialResult ? "partial" : "calculator");
            return;
          } catch { sessionStorage.removeItem(recoveryStorageKey); }
        }
        const created = await api<Projection & { token: string }>("/api/eos/recovery-calculator/sessions", { method: "POST", body: JSON.stringify({ companyId: recoveryCompanyId, source: "entrepreneuros-public", utm: Object.fromEntries(new URLSearchParams(window.location.search)) }) });
        if (!active) return;
        sessionStorage.setItem(recoveryStorageKey, created.token); setToken(created.token); setProjection(created);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "The calculator is unavailable."); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, []);

  const percentComplete = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const setNumber = (section: "profile" | "demand" | "estimates" | "customers", key: string, value: string) =>
    setInputs((current) => ({ ...current, [section]: { ...current[section], [key]: Number(value) } } as RecoveryCalculatorInput));

  async function calculate() {
    if (!token) return;
    setBusy(true); setError("");
    try {
      const next = await api<Projection>(`/api/eos/recovery-calculator/${token}/inputs`, { method: "PUT", body: JSON.stringify({ inputs, idempotencyKey: crypto.randomUUID() }) });
      setProjection(next); setMode("partial"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The modeled result could not be calculated."); }
    finally { setBusy(false); }
  }

  async function unlockReport(event: React.FormEvent) {
    event.preventDefault();
    if (!contact.consent) { setError("Choose the consent box to create and deliver the full report."); return; }
    setBusy(true); setError("");
    try {
      const next = await api<Projection>(`/api/eos/recovery-calculator/${token}/contact`, { method: "POST", body: JSON.stringify({ contact, idempotencyKey: crypto.randomUUID() }) });
      setProjection(next); setMode("report"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The report could not be unlocked."); }
    finally { setBusy(false); }
  }

  async function openCalendar() {
    if (!projection?.route?.calendarUrl) return;
    try { await api(`/api/eos/recovery-calculator/${token}/calendar-opened`, { method: "POST", body: "{}" }); } catch {}
    window.open(projection.route.calendarUrl, "_blank", "noopener,noreferrer");
  }

  function restart() {
    sessionStorage.removeItem(recoveryStorageKey);
    window.location.reload();
  }

  if (busy && !projection) return <main className="grid min-h-screen place-items-center bg-[#f7f5fb] px-6"><div className="text-center"><Sparkles className="mx-auto h-8 w-8 animate-pulse text-primary"/><p className="mt-4 font-semibold">Preparing your private diagnostic…</p></div></main>;

  return (
    <main className="min-h-screen bg-[#f7f5fb] text-foreground">
      <header className="border-b border-border/60 bg-white/90 px-5 py-4 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-6xl items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white"><Sparkles className="h-5 w-5"/></span><div><p className="text-sm font-bold">Empyrean Studios</p><p className="text-xs text-muted-foreground">Recovery System</p></div></div><button onClick={restart} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"><RotateCcw className="h-4 w-4"/>Start over</button></div></header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-14">
        {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {mode === "calculator" && <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="pt-2"><p className="eos-label text-primary">Booked Job Recovery Calculator</p><h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">See where booked-job opportunity may already be hiding.</h1><p className="mt-5 max-w-xl text-lg text-muted-foreground">Model open estimates, missed response, and past-customer opportunity from your own operating inputs. No CRM access or sales call required.</p><div className="mt-8 space-y-4 text-sm"><p className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><span><strong>Directional, not inflated.</strong> Every result is a transparent modeled range—not claimed lost revenue.</span></p><p className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><span><strong>Private by design.</strong> Contact details are requested only after you see a useful partial result.</span></p></div></div>
          <div className="rounded-2xl bg-white p-5 shadow-md sm:p-8">
            <div className="mb-7"><div className="flex items-center justify-between text-xs font-semibold"><span>{steps[step]}</span><span className="text-muted-foreground">{step + 1} of {steps.length}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percentComplete}%` }}/></div></div>

            <div className="grid gap-5">
              {step === 0 && <><Field label="Industry"><input className={inputClass} value={inputs.profile.industry} onChange={(e) => setInputs({ ...inputs, profile: { ...inputs.profile, industry: e.target.value } })}/></Field><Field label="Team size"><input className={inputClass} type="number" min="1" value={inputs.profile.teamSize} onChange={(e) => setNumber("profile", "teamSize", e.target.value)}/></Field><Field label="Primary service area"><input className={inputClass} placeholder="e.g. Phoenix metro" value={inputs.profile.serviceArea} onChange={(e) => setInputs({ ...inputs, profile: { ...inputs.profile, serviceArea: e.target.value } })}/></Field></>}
              {step === 1 && <><Field label="Monthly inbound leads"><input className={inputClass} type="number" min="0" value={inputs.demand.monthlyInboundLeads} onChange={(e) => setNumber("demand", "monthlyInboundLeads", e.target.value)}/></Field><Field label="Missed or unanswered leads (%)"><input className={inputClass} type="number" min="0" max="100" value={inputs.demand.missedOrUnansweredPercent} onChange={(e) => setNumber("demand", "missedOrUnansweredPercent", e.target.value)}/></Field><Field label="Average first response (minutes)"><input className={inputClass} type="number" min="0" value={inputs.demand.averageResponseMinutes} onChange={(e) => setNumber("demand", "averageResponseMinutes", e.target.value)}/></Field><Field label="Lead-to-estimate rate (%)"><input className={inputClass} type="number" min="0" max="100" value={inputs.demand.leadToEstimatePercent} onChange={(e) => setNumber("demand", "leadToEstimatePercent", e.target.value)}/></Field></>}
              {step === 2 && <><Field label="Open estimates"><input className={inputClass} type="number" min="0" value={inputs.estimates.openEstimates} onChange={(e) => setNumber("estimates", "openEstimates", e.target.value)}/></Field><Field label="Average job value"><input className={inputClass} type="number" min="0" value={inputs.estimates.averageJobValue} onChange={(e) => setNumber("estimates", "averageJobValue", e.target.value)}/></Field><Field label="Current estimate close rate (%)"><input className={inputClass} type="number" min="0" max="100" value={inputs.estimates.currentClosePercent} onChange={(e) => setNumber("estimates", "currentClosePercent", e.target.value)}/></Field><Field label="Estimates now stale (%)"><input className={inputClass} type="number" min="0" max="100" value={inputs.estimates.staleEstimatePercent} onChange={(e) => setNumber("estimates", "staleEstimatePercent", e.target.value)}/></Field><div className="grid grid-cols-2 gap-4"><Field label="Past customers"><input className={inputClass} type="number" min="0" value={inputs.customers.pastCustomers} onChange={(e) => setNumber("customers", "pastCustomers", e.target.value)}/></Field><Field label="Annual reactivation (%)"><input className={inputClass} type="number" min="0" max="100" value={inputs.customers.annualReactivationPercent} onChange={(e) => setNumber("customers", "annualReactivationPercent", e.target.value)}/></Field></div></>}
              {step === 3 && <><Field label="Source-data quality"><select className={selectClass} value={inputs.readiness.dataQuality} onChange={(e) => setInputs({ ...inputs, readiness: { ...inputs.readiness, dataQuality: e.target.value as any } })}><option value="clean">Clean and usable</option><option value="partial">Partial / needs review</option><option value="fragmented">Fragmented</option></select></Field><Field label="Follow-up ownership"><select className={selectClass} value={inputs.readiness.followUpOwnership} onChange={(e) => setInputs({ ...inputs, readiness: { ...inputs.readiness, followUpOwnership: e.target.value as any } })}><option value="clear">One clear owner</option><option value="shared">Shared inconsistently</option><option value="unowned">Often unowned</option></select></Field><Field label="Capacity for more booked work"><select className={selectClass} value={inputs.readiness.deliveryCapacity} onChange={(e) => setInputs({ ...inputs, readiness: { ...inputs.readiness, deliveryCapacity: e.target.value as any } })}><option value="available">Available</option><option value="limited">Limited</option><option value="constrained">Constrained</option></select></Field><Field label="Timing"><select className={selectClass} value={inputs.readiness.intent} onChange={(e) => setInputs({ ...inputs, readiness: { ...inputs.readiness, intent: e.target.value as any } })}><option value="within_30_days">Act within 30 days</option><option value="this_quarter">This quarter</option><option value="researching">Researching</option></select></Field></>}
            </div>
            <div className="mt-8 flex items-center justify-between gap-3"><button disabled={step === 0 || busy} onClick={() => setStep((value) => value - 1)} className="inline-flex h-12 items-center gap-2 rounded-xl px-4 font-semibold text-muted-foreground disabled:opacity-30"><ArrowLeft className="h-4 w-4"/>Back</button>{step < steps.length - 1 ? <button onClick={() => setStep((value) => value + 1)} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white">Continue<ArrowRight className="h-4 w-4"/></button> : <button disabled={busy} onClick={calculate} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white disabled:opacity-60"><BarChart3 className="h-4 w-4"/>Model my opportunity</button>}</div>
          </div>
        </div>}

        {mode === "partial" && projection?.partialResult && <div className="mx-auto max-w-4xl"><p className="eos-label text-primary">Your directional result</p><div className="mt-4 grid gap-5 sm:grid-cols-[1.3fr_0.7fr]"><div className="rounded-2xl bg-primary p-7 text-white shadow-lg sm:p-10"><p className="text-sm font-semibold text-white/70">Monthly modeled opportunity</p><p className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{money.format(projection.partialResult.range.low)}–{money.format(projection.partialResult.range.high)}</p><p className="mt-4 max-w-xl text-sm text-white/75">Base scenario: {money.format(projection.partialResult.range.base)}. This is not claimed lost revenue or a forecast.</p></div><div className="rounded-2xl bg-white p-7 shadow-md"><p className="text-sm font-semibold text-muted-foreground">Recovery Score</p><p className="mt-2 text-5xl font-semibold">{projection.partialResult.score}</p><p className="mt-3 text-sm capitalize text-muted-foreground">{projection.partialResult.fit.replaceAll("_", " ")}</p></div></div><div className="mt-5 rounded-2xl bg-white p-7 shadow-md"><p className="eos-label">Largest modeled pool</p><h2 className="mt-3 text-2xl font-semibold">{projection.partialResult.dominantOpportunity.label}</h2><p className="mt-2 text-muted-foreground">Base scenario contribution: {money.format(projection.partialResult.dominantOpportunity.base)} per month.</p><button onClick={() => setMode("contact")} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white sm:w-auto">Unlock the complete breakdown<ChevronRight className="h-4 w-4"/></button><p className="mt-4 text-xs text-muted-foreground">{projection.partialResult.disclaimer}</p></div></div>}

        {mode === "contact" && <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="eos-label text-primary">Complete report</p><h1 className="mt-4 text-4xl font-semibold">See all three opportunity pools.</h1><p className="mt-4 text-muted-foreground">We’ll bind the full result to your company, preserve the assumptions used, and route you to the next useful step.</p><ul className="mt-7 space-y-3 text-sm">{["Full pool-by-pool range", "Confidence gaps and assumptions", "A route based on fit and capacity"].map((item) => <li key={item} className="flex gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-primary-muted text-primary"><Check className="h-3.5 w-3.5"/></span>{item}</li>)}</ul></div><form onSubmit={unlockReport} className="rounded-2xl bg-white p-6 shadow-md sm:p-8"><div className="grid gap-5 sm:grid-cols-2"><Field label="First name"><input required className={inputClass} value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })}/></Field><Field label="Company"><input required className={inputClass} value={contact.companyName} onChange={(e) => setContact({ ...contact, companyName: e.target.value })}/></Field><Field label="Work email"><input required type="email" className={inputClass} value={contact.workEmail} onChange={(e) => setContact({ ...contact, workEmail: e.target.value })}/></Field><Field label="Phone (optional)"><input type="tel" className={inputClass} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })}/></Field></div><Field label="Preferred follow-up"><select className={selectClass} value={contact.communicationPreference} onChange={(e) => setContact({ ...contact, communicationPreference: e.target.value })}><option value="email">Email</option><option value="phone">Phone</option><option value="either">Either</option></select></Field><label className="mt-5 flex cursor-pointer gap-3 rounded-xl bg-muted p-4 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={contact.consent} onChange={(e) => setContact({ ...contact, consent: e.target.checked })}/><span>I agree that Empyrean Studios may use these details and my calculator inputs to create this report and contact me about the selected next step. I can opt out at any time.</span></label><button disabled={busy} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white disabled:opacity-60"><LockKeyhole className="h-4 w-4"/>Create my full report</button></form></div>}

        {mode === "report" && projection?.fullReport && <div className="mx-auto max-w-5xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eos-label text-primary">Complete Recovery report</p><h1 className="mt-3 text-4xl font-semibold">Your modeled opportunity, without the theater.</h1><p className="mt-3 max-w-2xl text-muted-foreground">Use this as a structured hypothesis. Validate source records, ownership, capacity, and attribution before acting.</p></div><div className="rounded-xl bg-primary-muted px-5 py-3 text-primary"><span className="text-xs font-semibold uppercase tracking-wide">Score</span><strong className="ml-3 text-2xl">{projection.fullReport.score}</strong></div></div><div className="mt-8 grid gap-5 md:grid-cols-3">{projection.fullReport.pools.map((pool) => <article key={pool.key} className="rounded-2xl bg-white p-6 shadow-md"><p className="eos-label">{pool.label}</p><p className="mt-4 text-2xl font-semibold">{money.format(pool.low)}–{money.format(pool.high)}</p><p className="mt-1 text-sm text-muted-foreground">Base {money.format(pool.base)} / month</p><p className="mt-5 text-sm text-muted-foreground">{pool.explanation}</p></article>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-white p-6 shadow-md"><h2 className="text-xl font-semibold">Confidence gaps</h2>{projection.fullReport.confidenceGaps.length ? <ul className="mt-4 space-y-3 text-sm text-muted-foreground">{projection.fullReport.confidenceGaps.map((gap) => <li key={gap} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"/>{gap}</li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No major input-level gaps were identified. Record-level validation is still required.</p>}</section><section className="rounded-2xl bg-white p-6 shadow-md"><h2 className="text-xl font-semibold">Recommended next step</h2><p className="mt-4 text-sm text-muted-foreground">{projection.route?.message}</p>{projection.route?.calendarUrl ? <button onClick={openCalendar} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white">Book a Recovery diagnostic<ArrowRight className="h-4 w-4"/></button> : projection.route?.key === "recovery_diagnostic" ? <div className="mt-6 rounded-xl bg-warning-muted p-4 text-sm text-warning">The live diagnostic calendar has not been activated yet. Your report is saved; Empyrean can follow up using your selected preference.</div> : <button onClick={restart} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-white">Run another scenario<RotateCcw className="h-4 w-4"/></button>}</section></div><p className="mt-6 text-xs text-muted-foreground">{projection.fullReport.disclaimer} Assumption version: {projection.fullReport.assumptionVersion}.</p></div>}
      </section>
    </main>
  );
}
