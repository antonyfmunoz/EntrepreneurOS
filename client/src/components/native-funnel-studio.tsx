import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  Globe2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  nativeSiteSectionKinds,
  nativeSiteSectionLabels,
  type NativeSiteSection,
  type NativeSiteSectionKind,
} from "@shared/native-site-sections";

type Json = Record<string, any>;
type PageCtaTarget = "manual" | "capture_form" | "funnel";

const pageSectionStarter: NativeSiteSection[] = [
  {
    id: "outcomes",
    kind: "outcomes",
    title: "What changes",
    body: "",
    items: ["A clear, measurable outcome"],
  },
  {
    id: "steps",
    kind: "steps",
    title: "How it works",
    body: "",
    items: ["Start with a focused review", "Receive the recommended next step"],
  },
];

function commandKey(prefix: string) {
  const suffix =
    globalThis.crypto?.randomUUID?.() ||
    String(Date.now()) + "-" + Math.random().toString(36).slice(2);
  return prefix + ":" + suffix;
}
function safeKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}
function normalizedPath(value: string, fallbackTitle: string) {
  const raw = value.trim().replace(/^\/+/, "");
  return (
    "/" +
    (raw || safeKey(fallbackTitle))
      .replace(/[^a-z0-9/-]+/gi, "-")
      .replace(/\/{2,}/g, "/")
      .replace(/-+$/g, "")
  );
}
function funnelUrl(funnelId: string) {
  return window.location.origin + "/f/" + funnelId;
}
function pageUrl(page: Json) {
  const siteId =
    typeof page.data?.siteObjectId === "string" ? page.data.siteObjectId : "";
  const path = typeof page.data?.path === "string" ? page.data.path : "";
  return siteId && path
    ? window.location.origin + "/s/" + siteId + path
    : window.location.origin + "/p/" + page.id;
}

export function NativeFunnelStudio({
  root,
  canExecute,
  canDecide,
}: {
  root: string;
  canExecute: boolean;
  canDecide: boolean;
}) {
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [supportingCopy, setSupportingCopy] = useState("");
  const [primaryCtaLabel, setPrimaryCtaLabel] = useState("Start here");
  const [captureFormObjectId, setCaptureFormObjectId] = useState("");
  const [siteName, setSiteName] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageHeadline, setPageHeadline] = useState("");
  const [pageSupportingCopy, setPageSupportingCopy] = useState("");
  const [pageCtaLabel, setPageCtaLabel] = useState("");
  const [pageCtaHref, setPageCtaHref] = useState("");
  const [pageCtaTarget, setPageCtaTarget] = useState<PageCtaTarget>("manual");
  const [pageCtaTargetId, setPageCtaTargetId] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [pageSections, setPageSections] = useState<NativeSiteSection[]>([]);
  const [editingPage, setEditingPage] = useState<Json | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const formsQuery = useQuery<Json>({
    queryKey: [root, "native-funnel-forms"],
    queryFn: async () =>
      (await apiRequest("GET", root + "/instruments/forms")).json(),
  });
  const websitesQuery = useQuery<Json>({
    queryKey: [root, "native-websites"],
    queryFn: async () =>
      (await apiRequest("GET", root + "/instruments/websites")).json(),
  });
  const publishedForms = useMemo(
    () =>
      (formsQuery.data?.objects || []).filter(
        (item: Json) =>
          item.objectType === "form" &&
          item.state === "active" &&
          item.data?.publicCapture === true,
      ),
    [formsQuery.data],
  );
  const funnels = useMemo(
    () =>
      (websitesQuery.data?.objects || []).filter(
        (item: Json) =>
          item.objectType === "funnel" && item.data?.publicFunnel === true,
      ),
    [websitesQuery.data],
  );
  const sites = useMemo(
    () =>
      (websitesQuery.data?.objects || []).filter(
        (item: Json) => item.objectType === "site",
      ),
    [websitesQuery.data],
  );
  const activeSites = useMemo(
    () => sites.filter((site: Json) => site.state === "active"),
    [sites],
  );
  const pages = useMemo(
    () =>
      (websitesQuery.data?.objects || []).filter(
        (item: Json) =>
          item.objectType === "page" && item.data?.publicPage === true,
      ),
    [websitesQuery.data],
  );
  const activeFunnels = useMemo(
    () => funnels.filter((funnel: Json) => funnel.state === "active"),
    [funnels],
  );
  const selectedSite =
    activeSites.find((site: Json) => site.id === selectedSiteId) || null;

  useEffect(() => {
    if (!selectedSiteId && activeSites[0]) setSelectedSiteId(activeSites[0].id);
    if (
      selectedSiteId &&
      !activeSites.some((site: Json) => site.id === selectedSiteId)
    )
      setSelectedSiteId(activeSites[0]?.id || "");
  }, [activeSites, selectedSiteId]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [root, "native-funnel-forms"],
      }),
      queryClient.invalidateQueries({ queryKey: [root, "native-websites"] }),
    ]);
  };
  const create = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", root + "/instrument-objects", {
          instrumentKey: "websites",
          objectType: "funnel",
          objectKey: "funnel:" + safeKey(title) + ":" + Date.now(),
          title: title.trim(),
          summary: supportingCopy.trim(),
          classification: "confidential",
          visibility: "organization",
          data: {
            publicFunnel: true,
            headline: headline.trim(),
            supportingCopy: supportingCopy.trim(),
            primaryCtaLabel: primaryCtaLabel.trim(),
            captureFormObjectId,
          },
          sourceReference: {
            authority: "native_eos",
            capability: "native_website_funnel",
          },
          evidenceIds: [],
          idempotencyKey: commandKey("native-funnel-create"),
        })
      ).json(),
    onSuccess: async () => {
      setTitle("");
      setHeadline("");
      setSupportingCopy("");
      setPrimaryCtaLabel("Start here");
      setCaptureFormObjectId("");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const publish = useMutation({
    mutationFn: async (object: Json) =>
      (
        await apiRequest(
          "POST",
          root + "/instrument-objects/" + object.id + "/transitions",
          {
            expectedVersion: object.version,
            state: "active",
            rationale:
              object.objectType === "site"
                ? "Publish this EOS-owned website so approved public pages can be served from the company workspace."
                : object.objectType === "page"
                  ? "Publish this EOS-owned public page after its copy, path, and call to action have been reviewed."
                  : "Publish this native EOS funnel so approved public copy routes visitors to an active consented EOS lead-capture form.",
            evidenceIds: [],
            idempotencyKey: commandKey("native-website-publish"),
          },
        )
      ).json(),
    onSuccess: refresh,
    onError: (cause: Error) => setError(cause.message),
  });
  const createSite = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", root + "/instrument-objects", {
          instrumentKey: "websites",
          objectType: "site",
          objectKey: "site:" + safeKey(siteName) + ":" + Date.now(),
          title: siteName.trim(),
          summary: "EOS-owned native website",
          classification: "confidential",
          visibility: "organization",
          data: { brandName: siteName.trim() },
          sourceReference: {
            authority: "native_eos",
            capability: "native_website",
          },
          evidenceIds: [],
          idempotencyKey: commandKey("native-site-create"),
        })
      ).json(),
    onSuccess: async () => {
      setSiteName("");
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const createPage = useMutation({
    mutationFn: async () => {
      if (!selectedSite)
        throw new Error(
          "Choose a published EOS site before adding a public page.",
        );
      return (
        await apiRequest("POST", root + "/instrument-objects", {
          instrumentKey: "websites",
          objectType: "page",
          objectKey: "page:" + safeKey(pageTitle) + ":" + Date.now(),
          title: pageTitle.trim(),
          summary: pageSupportingCopy.trim() || pageHeadline.trim(),
          classification: "confidential",
          visibility: "organization",
          data: {
            publicPage: true,
            siteObjectId: selectedSite.id,
            headline: pageHeadline.trim(),
            supportingCopy: pageSupportingCopy.trim(),
            primaryCtaLabel: pageCtaLabel.trim(),
            primaryCtaTarget: pageCtaTarget,
            primaryCtaTargetId:
              pageCtaTarget === "manual" ? null : pageCtaTargetId || null,
            primaryCtaHref:
              pageCtaTarget === "manual" ? pageCtaHref.trim() : "",
            path: normalizedPath(pagePath, pageTitle),
            sections: pageSections,
          },
          sourceReference: {
            authority: "native_eos",
            capability: "native_website_page",
          },
          evidenceIds: [],
          idempotencyKey: commandKey("native-page-create"),
        })
      ).json();
    },
    onSuccess: async () => {
      cancelPageEdit();
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const updatePage = useMutation({
    mutationFn: async () => {
      if (!editingPage) throw new Error("Choose a page to edit.");
      return (
        await apiRequest(
          "PATCH",
          root + "/instrument-objects/" + editingPage.id,
          {
            expectedVersion: editingPage.version,
            title: pageTitle.trim(),
            summary: pageSupportingCopy.trim() || pageHeadline.trim(),
            data: {
              ...editingPage.data,
              publicPage: true,
              siteObjectId: editingPage.data?.siteObjectId,
              headline: pageHeadline.trim(),
              supportingCopy: pageSupportingCopy.trim(),
              primaryCtaLabel: pageCtaLabel.trim(),
              primaryCtaTarget: pageCtaTarget,
              primaryCtaTargetId:
                pageCtaTarget === "manual" ? null : pageCtaTargetId || null,
              primaryCtaHref:
                pageCtaTarget === "manual" ? pageCtaHref.trim() : "",
              path: normalizedPath(pagePath, pageTitle),
              sections: pageSections,
            },
            idempotencyKey: commandKey("native-page-update"),
          },
        )
      ).json();
    },
    onSuccess: async () => {
      cancelPageEdit();
      await refresh();
    },
    onError: (cause: Error) => setError(cause.message),
  });
  const beginPageEdit = (page: Json) => {
    const target = ["capture_form", "funnel"].includes(
      page.data?.primaryCtaTarget,
    )
      ? (page.data.primaryCtaTarget as PageCtaTarget)
      : "manual";
    setEditingPage(page);
    setPageTitle(page.title || "");
    setPageHeadline(page.data?.headline || "");
    setPageSupportingCopy(page.data?.supportingCopy || "");
    setPageCtaLabel(page.data?.primaryCtaLabel || "");
    setPageCtaTarget(target);
    setPageCtaTargetId(page.data?.primaryCtaTargetId || "");
    setPageCtaHref(page.data?.primaryCtaHref || "");
    setPagePath(page.data?.path || "");
    setPageSections(
      Array.isArray(page.data?.sections) ? page.data.sections : [],
    );
    setError("");
  };
  const cancelPageEdit = () => {
    setEditingPage(null);
    setPageTitle("");
    setPageHeadline("");
    setPageSupportingCopy("");
    setPageCtaLabel("");
    setPageCtaTarget("manual");
    setPageCtaTargetId("");
    setPageCtaHref("");
    setPagePath("");
    setPageSections([]);
  };
  const addSection = () =>
    setPageSections((sections) => [
      ...sections,
      {
        id: `section_${Date.now()}`,
        kind: "callout",
        title: "New section",
        body: "",
        items: [],
      },
    ]);
  const addStarterSections = () =>
    setPageSections((sections) =>
      sections.length
        ? sections
        : pageSectionStarter.map((section) => ({
            ...section,
            items: [...section.items],
          })),
    );
  const updateSection = (id: string, patch: Partial<NativeSiteSection>) =>
    setPageSections((sections) =>
      sections.map((section) =>
        section.id === id ? { ...section, ...patch } : section,
      ),
    );
  const removeSection = (id: string) =>
    setPageSections((sections) =>
      sections.filter((section) => section.id !== id),
    );
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(
        () => setCopied((current) => (current === url ? "" : current)),
        1_800,
      );
    } catch {
      setError(
        "Copy was unavailable in this browser. Select the link and copy it manually.",
      );
    }
  };
  const pageFormTitle = editingPage ? "Edit public page" : "Create public page";

  return (
    <Card data-testid="native-funnel-studio">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              Native Website & Funnel Studio
            </CardTitle>
            <CardDescription className="mt-1">
              Build, review, publish, and operate EOS-owned public sites, pages,
              and conversion paths. No external website, funnel, or CRM
              subscription is required.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              formsQuery.refetch();
              websitesQuery.refetch();
            }}
            disabled={formsQuery.isFetching || websitesQuery.isFetching}
          >
            <RefreshCw
              className={
                "mr-2 h-4 w-4 " +
                (formsQuery.isFetching || websitesQuery.isFetching
                  ? "animate-spin"
                  : "")
              }
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Website command not applied</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <section className="rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Native website</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A site provides the company-owned public surface. Pages and funnels
            stay in the same governed EOS workspace.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="min-w-56 flex-1">
              <Label htmlFor="site-name">Site / brand name</Label>
              <Input
                id="site-name"
                className="mt-1"
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                placeholder="Empyrean Studios"
              />
            </div>
            <Button
              className="self-end"
              size="sm"
              disabled={
                !canExecute ||
                siteName.trim().length < 2 ||
                createSite.isPending
              }
              onClick={() => createSite.mutate()}
            >
              {createSite.isPending ? "Creating…" : "Create site"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sites.map((site: Json) => (
              <div
                key={site.id}
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="font-medium">{site.title}</span>
                <Badge
                  variant={site.state === "active" ? "default" : "outline"}
                >
                  {site.state}
                </Badge>
                {site.state === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canDecide || publish.isPending}
                    onClick={() => publish.mutate(site)}
                  >
                    Publish
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!sites.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              No native sites yet. Create one here; a decision-authorized role
              publishes it once it is ready to carry public pages.
            </p>
          )}
        </section>
        <section className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">{pageFormTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The public presentation is editable here; publishing remains a
                separate decision.
              </p>
            </div>
            {editingPage && (
              <Button size="sm" variant="ghost" onClick={cancelPageEdit}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="page-site">Published site</Label>
              <select
                id="page-site"
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editingPage?.data?.siteObjectId || selectedSiteId}
                disabled={Boolean(editingPage)}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                <option value="">Choose a published EOS site</option>
                {activeSites.map((site: Json) => (
                  <option key={site.id} value={site.id}>
                    {site.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="site-page-title">Internal page name</Label>
              <Input
                id="site-page-title"
                className="mt-1"
                value={pageTitle}
                onChange={(event) => setPageTitle(event.target.value)}
                placeholder="Revenue Recovery"
              />
            </div>
            <div>
              <Label htmlFor="site-page-headline">Public headline</Label>
              <Input
                id="site-page-headline"
                className="mt-1"
                value={pageHeadline}
                onChange={(event) => setPageHeadline(event.target.value)}
                placeholder="Recover revenue your business has already earned."
              />
            </div>
            <div>
              <Label htmlFor="site-page-path">Public path</Label>
              <Input
                id="site-page-path"
                className="mt-1"
                value={pagePath}
                onChange={(event) => setPagePath(event.target.value)}
                placeholder="/revenue-recovery"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="site-page-copy">Supporting copy</Label>
            <Textarea
              id="site-page-copy"
              className="mt-1 min-h-24"
              value={pageSupportingCopy}
              onChange={(event) => setPageSupportingCopy(event.target.value)}
              placeholder="Explain the result, who this is for, and what happens next."
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="site-page-cta-label">
                Button label (optional)
              </Label>
              <Input
                id="site-page-cta-label"
                className="mt-1"
                value={pageCtaLabel}
                onChange={(event) => setPageCtaLabel(event.target.value)}
                placeholder="Request a review"
              />
            </div>
            <div>
              <Label htmlFor="site-page-cta-target">Button destination</Label>
              <select
                id="site-page-cta-target"
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={pageCtaTarget}
                onChange={(event) => {
                  setPageCtaTarget(event.target.value as PageCtaTarget);
                  setPageCtaTargetId("");
                }}
              >
                <option value="manual">A manual link</option>
                <option value="capture_form">An EOS intake form</option>
                <option value="funnel">An EOS funnel</option>
              </select>
            </div>
          </div>
          {pageCtaTarget === "manual" ? (
            <div className="mt-3">
              <Label htmlFor="site-page-cta-href">Manual button link</Label>
              <Input
                id="site-page-cta-href"
                className="mt-1"
                value={pageCtaHref}
                onChange={(event) => setPageCtaHref(event.target.value)}
                placeholder="/contact"
              />
            </div>
          ) : (
            <div className="mt-3">
              <Label htmlFor="site-page-cta-native-target">
                EOS-owned destination
              </Label>
              <select
                id="site-page-cta-native-target"
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={pageCtaTargetId}
                onChange={(event) => setPageCtaTargetId(event.target.value)}
              >
                <option value="">
                  Choose an active{" "}
                  {pageCtaTarget === "capture_form" ? "intake form" : "funnel"}
                </option>
                {(pageCtaTarget === "capture_form"
                  ? publishedForms
                  : activeFunnels
                ).map((target: Json) => (
                  <option key={target.id} value={target.id}>
                    {target.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                EOS keeps this relationship intact if the public route changes;
                it will not expose inactive or cross-company targets.
              </p>
            </div>
          )}
          <div className="mt-5 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Label>Page sections</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Arrange reusable no-code content blocks. EOS publishes plain,
                  reviewable copy only—no pasted scripts or hidden external
                  widgets.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addStarterSections}
                  disabled={Boolean(pageSections.length)}
                >
                  Use starter sections
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addSection}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add section
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {pageSections.map((section, index) => (
                <div
                  key={section.id + index}
                  className="rounded-lg border bg-background p-3"
                >
                  <div className="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_auto]">
                    <select
                      aria-label={`Section ${index + 1} type`}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                      value={section.kind}
                      onChange={(event) =>
                        updateSection(section.id, {
                          kind: event.target.value as NativeSiteSectionKind,
                        })
                      }
                    >
                      {nativeSiteSectionKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {nativeSiteSectionLabels[kind]}
                        </option>
                      ))}
                    </select>
                    <Input
                      aria-label={`Section ${index + 1} title`}
                      value={section.title}
                      onChange={(event) =>
                        updateSection(section.id, { title: event.target.value })
                      }
                      placeholder="Section heading"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove section ${index + 1}`}
                      onClick={() => removeSection(section.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-2 min-h-16"
                    aria-label={`Section ${index + 1} supporting copy`}
                    value={section.body}
                    onChange={(event) =>
                      updateSection(section.id, { body: event.target.value })
                    }
                    placeholder="Supporting copy (optional when the section has items)"
                  />
                  <Textarea
                    className="mt-2 min-h-16"
                    aria-label={`Section ${index + 1} items`}
                    value={section.items.join("\n")}
                    onChange={(event) =>
                      updateSection(section.id, {
                        items: event.target.value
                          .split("\n")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="One item per line"
                  />
                </div>
              ))}
              {!pageSections.length && (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  No optional sections yet. Use the starter blocks or build your
                  own arrangement.
                </p>
              )}
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={
              !canExecute ||
              (!editingPage && !selectedSite) ||
              pageTitle.trim().length < 2 ||
              pageHeadline.trim().length < 2 ||
              pageSections.some(
                (section) =>
                  section.id.length < 2 ||
                  section.title.trim().length < 2 ||
                  (["outcomes", "steps", "proof", "faq"].includes(
                    section.kind,
                  ) &&
                    !section.body.trim() &&
                    !section.items.length),
              ) ||
              (pageCtaTarget !== "manual" &&
                Boolean(pageCtaLabel.trim()) &&
                !pageCtaTargetId) ||
              createPage.isPending ||
              updatePage.isPending
            }
            onClick={() =>
              editingPage ? updatePage.mutate() : createPage.mutate()
            }
          >
            {editingPage ? (
              <>
                <Save className="mr-2 h-4 w-4" />
                {updatePage.isPending ? "Saving…" : "Save page"}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {createPage.isPending ? "Creating…" : "Create draft page"}
              </>
            )}
          </Button>
        </section>
        <section className="space-y-3">
          <div>
            <p className="eos-label">Website pages</p>
            <h3 className="mt-1 font-semibold">Your EOS-owned public pages</h3>
          </div>
          {pages.map((page: Json) => {
            const linkedSite = sites.find(
              (site: Json) => site.id === page.data?.siteObjectId,
            );
            const url = pageUrl(page);
            return (
              <div key={page.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{page.title}</span>
                      <Badge
                        variant={
                          page.state === "active" ? "default" : "outline"
                        }
                      >
                        {page.state}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {linkedSite?.title || "Unavailable site"} ·{" "}
                      {page.data?.path || "/"} ·{" "}
                      {page.data?.headline || "No headline recorded."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canExecute}
                      onClick={() => beginPageEdit(page)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    {page.state === "draft" ? (
                      <Button
                        size="sm"
                        disabled={!canDecide || publish.isPending}
                        onClick={() => publish.mutate(page)}
                      >
                        {publish.isPending ? "Publishing…" : "Publish page"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <a href={url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                {page.state === "active" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={url}
                      aria-label={page.title + " public page link"}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(url)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copied === url ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {!pages.length && (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              No native EOS public pages yet. Create one above, review its copy,
              then publish it with the appropriate decision authority.
            </p>
          )}
        </section>
        <section className="rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Create an EOS-owned funnel</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A funnel is a specialized conversion page. It can only route to an
            already-published native form, keeping public intent, consent, and
            CRM intake in EOS.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="funnel-title">Internal funnel name</Label>
                <Input
                  id="funnel-title"
                  className="mt-1"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Revenue recovery offer"
                />
              </div>
              <div>
                <Label htmlFor="funnel-cta">Primary button</Label>
                <Input
                  id="funnel-cta"
                  className="mt-1"
                  value={primaryCtaLabel}
                  onChange={(event) => setPrimaryCtaLabel(event.target.value)}
                  placeholder="Start here"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="funnel-headline">Public headline</Label>
              <Input
                id="funnel-headline"
                className="mt-1"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="Recover revenue your business has already earned."
              />
            </div>
            <div>
              <Label htmlFor="funnel-copy">Supporting copy</Label>
              <Textarea
                id="funnel-copy"
                className="mt-1 min-h-24"
                value={supportingCopy}
                onChange={(event) => setSupportingCopy(event.target.value)}
                placeholder="Explain the outcome, who it is for, and what happens after the visitor starts."
              />
            </div>
            <div>
              <Label htmlFor="funnel-form">Published native intake point</Label>
              <select
                id="funnel-form"
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={captureFormObjectId}
                onChange={(event) => setCaptureFormObjectId(event.target.value)}
              >
                <option value="">Choose a published native form</option>
                {publishedForms.map((form: Json) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
              {!publishedForms.length && (
                <p className="mt-2 text-sm text-amber-700">
                  Publish a native form in Lead Capture Studio first. EOS will
                  not publish a funnel with nowhere governed to send the
                  visitor.
                </p>
              )}
            </div>
            <Button
              disabled={
                !canExecute ||
                title.trim().length < 2 ||
                headline.trim().length < 2 ||
                primaryCtaLabel.trim().length < 2 ||
                !captureFormObjectId ||
                create.isPending
              }
              onClick={() => create.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {create.isPending ? "Creating funnel…" : "Create native funnel"}
            </Button>
          </div>
        </section>
        <section className="space-y-3">
          <div>
            <p className="eos-label">Funnels</p>
            <h3 className="mt-1 font-semibold">
              Your EOS-owned conversion paths
            </h3>
          </div>
          {funnels.map((funnel: Json) => {
            const url = funnelUrl(funnel.id);
            const linkedForm = publishedForms.find(
              (form: Json) => form.id === funnel.data?.captureFormObjectId,
            );
            return (
              <div key={funnel.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{funnel.title}</span>
                      <Badge
                        variant={
                          funnel.state === "active" ? "default" : "outline"
                        }
                      >
                        {funnel.state}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {funnel.data?.headline || "No public headline recorded."}
                      {linkedForm
                        ? " · Routes to " + linkedForm.title
                        : " · Intake point is unavailable"}
                    </p>
                  </div>
                  {funnel.state === "draft" && (
                    <Button
                      size="sm"
                      disabled={!canDecide || !linkedForm || publish.isPending}
                      onClick={() => publish.mutate(funnel)}
                    >
                      {publish.isPending
                        ? "Publishing…"
                        : "Publish native funnel"}
                    </Button>
                  )}
                </div>
                {funnel.state === "active" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={url}
                      aria-label={funnel.title + " public funnel link"}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(url)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copied === url ? "Copied" : "Copy link"}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {!funnels.length && (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              No native EOS funnels yet. Create one above; it stays a draft
              until a role with decision authority publishes it.
            </p>
          )}
        </section>
        <Alert>
          <AlertTitle>Native first, overlay ready</AlertTitle>
          <AlertDescription>
            This is the owned EOS front door. A future website or CRM
            integration may reconcile imported pages and demand into the same
            governed model, but the site, funnel, consented form, and resulting
            CRM records remain usable with no provider connected.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
