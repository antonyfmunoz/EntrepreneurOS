import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarCheck2, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PublicCalendar = {
  id: string;
  title: string;
  summary: string;
  companyName: string;
  timeZone: string;
  durationMinutes: number;
  slots: string[];
  consentLabel: string;
};

function calendarIdFromPath() {
  return decodeURIComponent(window.location.pathname.replace(/^\/book\//, "").split("/")[0] || "");
}

function slotLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

export default function PublicBookingPage() {
  const calendarId = calendarIdFromPath();
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const query = useQuery<{ calendar: PublicCalendar }>({
    queryKey: ["public-booking", calendarId],
    queryFn: async () => {
      const response = await fetch(`/api/public/bookings/${encodeURIComponent(calendarId)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "This booking page is unavailable.");
      return body;
    },
    retry: false,
  });
  const reserve = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/bookings/${encodeURIComponent(calendarId)}/reservations`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ startsAt, name, email, phone, companyName, note, consent, website }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Your booking could not be recorded.");
      return body as { confirmationMessage: string; startsAt: string };
    },
  });
  const calendar = query.data?.calendar;
  const slotsByDay = useMemo(() => {
    if (!calendar) return [] as Array<[string, string[]]>;
    return Object.entries(calendar.slots.reduce<Record<string, string[]>>((groups, slot) => {
      const key = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: calendar.timeZone }).format(new Date(slot));
      (groups[key] ||= []).push(slot);
      return groups;
    }, {}));
  }, [calendar]);

  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /></main>;
  if (!calendar) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-medium text-slate-500">EOS booking</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">This booking page is unavailable</h1><p className="mt-3 text-slate-600">{query.error instanceof Error ? query.error.message : "The link may be incomplete or the calendar is no longer published."}</p></section></main>;
  if (reserve.data) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600"/><p className="mt-5 text-sm font-medium text-slate-500">{calendar.companyName}</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Your meeting is recorded</h1><p className="mt-3 text-slate-600">{slotLabel(reserve.data.startsAt, calendar.timeZone)} · {calendar.timeZone}</p><p className="mt-3 text-slate-600">{reserve.data.confirmationMessage}</p></section></main>;

  return <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8"><section className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-6 shadow-sm sm:p-10"><p className="text-sm font-medium text-violet-700">{calendar.companyName}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{calendar.title}</h1>{calendar.summary && <p className="mt-3 max-w-2xl text-base text-slate-600">{calendar.summary}</p>}<p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" />{calendar.durationMinutes} minutes · {calendar.timeZone}</p><div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]"><section><div className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-violet-700"/><h2 className="font-semibold text-slate-950">Choose a time</h2></div>{slotsByDay.length ? <div className="mt-4 space-y-5">{slotsByDay.map(([day, slots]) => <div key={day}><p className="text-sm font-medium text-slate-700">{day}</p><div className="mt-2 flex flex-wrap gap-2">{slots.map((slot) => <button key={slot} type="button" aria-pressed={startsAt === slot} onClick={() => setStartsAt(slot)} className={`rounded-lg border px-3 py-2 text-sm transition ${startsAt === slot ? "border-violet-600 bg-violet-50 text-violet-800 ring-1 ring-violet-600" : "border-slate-200 text-slate-700 hover:border-violet-300"}`}>{slotLabel(slot, calendar.timeZone).split(", ").at(-1)}</button>)}</div></div>)}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No times are currently available. Check back later or contact the organization directly.</p>}</section><form className="rounded-xl border border-slate-200 p-5" onSubmit={(event) => { event.preventDefault(); reserve.mutate(); }}><h2 className="font-semibold text-slate-950">Your details</h2><div className="mt-4 space-y-4"><label className="block text-sm font-medium text-slate-700">Name<Input className="mt-2" required value={name} onChange={(event) => setName(event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Email<Input className="mt-2" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Phone <span className="font-normal text-slate-500">(optional)</span><Input className="mt-2" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Company <span className="font-normal text-slate-500">(optional)</span><Input className="mt-2" value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label><label className="block text-sm font-medium text-slate-700">Anything we should know? <span className="font-normal text-slate-500">(optional)</span><Textarea className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} /></label><label className="hidden" aria-hidden="true"><span>Website</span><Input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label><label className="flex items-start gap-3 text-sm text-slate-600"><input className="mt-1" type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{calendar.consentLabel}</span></label>{reserve.error instanceof Error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{reserve.error.message}</p>}<Button type="submit" className="w-full" disabled={!startsAt || !consent || reserve.isPending}>{reserve.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Recording…</> : "Request this time"}</Button></div></form></div></section></main>;
}
