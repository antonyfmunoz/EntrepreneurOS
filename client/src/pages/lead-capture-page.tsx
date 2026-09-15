import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Question = { id: string; label: string; type: "short_text" | "long_text" | "email" | "phone" | "select"; required: boolean; options: string[] };
type PublicForm = { id: string; title: string; summary: string; questions: Question[]; consentLabel: string; companyName: string };
function formIdFromPath() { return decodeURIComponent(window.location.pathname.replace(/^\/capture\//, "").split("/")[0] || ""); }

export default function LeadCapturePage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const formId = formIdFromPath();
  const query = useQuery<{ form: PublicForm }>({
    queryKey: ["public-lead-form", formId],
    queryFn: async () => {
      const response = await fetch("/api/public/lead-forms/" + encodeURIComponent(formId), { headers: { Accept: "application/json" } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "This form is unavailable.");
      return body;
    },
    retry: false,
  });
  const submit = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/public/lead-forms/" + encodeURIComponent(formId) + "/submissions", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ answers, consent, website }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Your request could not be submitted.");
      return body as { confirmationMessage: string };
    },
  });
  const form = query.data?.form;
  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></main>;
  if (!form) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-medium text-slate-500">EOS lead capture</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">This form is unavailable</h1><p className="mt-3 text-slate-600">{query.error instanceof Error ? query.error.message : "The link may be incomplete or the form is no longer published."}</p></section></main>;
  if (submit.data) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><p className="mt-5 text-sm font-medium text-slate-500">{form.companyName}</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Thank you</h1><p className="mt-3 text-slate-600">{submit.data.confirmationMessage}</p></section></main>;
  return <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8"><section className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-sm sm:p-10"><p className="text-sm font-medium text-violet-700">{form.companyName}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{form.title}</h1>{form.summary && <p className="mt-3 text-base text-slate-600">{form.summary}</p>}<form className="mt-8 space-y-5" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}>{form.questions.map((question) => <label key={question.id} className="block text-sm font-medium text-slate-800"><span>{question.label}{question.required && <span className="ml-1 text-rose-600">*</span>}</span>{question.type === "long_text" ? <Textarea className="mt-2 min-h-28" required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /> : question.type === "select" ? <select className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}><option value="">Choose one</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <Input className="mt-2" type={question.type === "email" ? "email" : question.type === "phone" ? "tel" : "text"} required={question.required} value={answers[question.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />}</label>)}<label className="hidden" aria-hidden="true"><span>Website</span><Input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label><label className="flex items-start gap-3 text-sm text-slate-600"><input className="mt-1" type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{form.consentLabel}</span></label>{submit.error instanceof Error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{submit.error.message}</p>}<Button type="submit" className="w-full" disabled={submit.isPending || !consent}>{submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send request"}</Button></form></section></main>;
}
