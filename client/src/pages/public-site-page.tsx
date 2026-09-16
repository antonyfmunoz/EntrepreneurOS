import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PublicPage = { id: string; siteName: string; companyName: string; headline: string; supportingCopy: string; primaryCtaLabel: string; primaryCtaHref: string; path: string };
function pageId() { return decodeURIComponent(window.location.pathname.replace(/^\/p\//, "").split("/")[0] || ""); }
export default function PublicSitePage() {
  const id = pageId();
  const query = useQuery<{ page: PublicPage }>({ queryKey: ["public-page", id], queryFn: async () => { const response = await fetch("/api/public/pages/" + encodeURIComponent(id)); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || "This page is unavailable."); return body; }, retry: false });
  const page = query.data?.page;
  if (query.isLoading) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6"><Loader2 className="h-7 w-7 animate-spin text-violet-300" /></main>;
  if (!page) return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8"><p className="text-sm font-medium text-violet-200">EOS public site</p><h1 className="mt-2 text-2xl font-semibold">This page is unavailable</h1><p className="mt-3 text-slate-300">{query.error instanceof Error ? query.error.message : "The link may be incomplete or unpublished."}</p></section></main>;
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-white sm:px-8 sm:py-16"><section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center"><div className="max-w-3xl"><p className="text-sm font-medium uppercase tracking-[0.18em] text-violet-200">{page.siteName}</p><h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">{page.headline}</h1>{page.supportingCopy && <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">{page.supportingCopy}</p>}{page.primaryCtaLabel && page.primaryCtaHref && <Button className="mt-9 h-12 rounded-full px-6" asChild><a href={page.primaryCtaHref}>{page.primaryCtaLabel}<ArrowRight className="ml-2 h-4 w-4" /></a></Button>}<p className="mt-6 text-sm text-slate-400">Published natively by {page.companyName}'s EOS workspace.</p></div></section></main>;
}
