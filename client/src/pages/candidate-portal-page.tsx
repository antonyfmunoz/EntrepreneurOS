import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileUp,
  Loader2,
  LockKeyhole,
  Mic,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

type PortalView = {
  company: { name: string };
  candidate: { name: string };
  application: {
    status: string;
    actions: {
      canEditIntake: boolean;
      canSubmitIntake: boolean;
      canSubmitEvidence: boolean;
      canAskQuestion: boolean;
      canWithdraw: boolean;
    };
    summary: string;
    intake: Intake;
    consentState: string;
    consentScope: string[];
    correctionStatus: string;
    candidateCorrection: string;
    plausibleRoles: string[];
    retentionUntil: string | null;
    deletionRequestedAt: string | null;
    nextAction: string;
  };
  opportunity: { title: string; outcomes: string[] };
  assessments: Array<{
    id: string;
    title: string;
    assessmentType: string;
    status: string;
    actionRequired: boolean;
    decisionQuestion: string;
    evidenceExpected: string;
    validityScope: string;
    candidateBurden: string;
    candidateSubmission: string;
    consentRequired: boolean;
    consentCaptured: boolean;
    adaptive: boolean;
    generatedSequence: number;
    roleHypotheses: string[];
  }>;
  adaptiveQuestioning: {
    consentActive: boolean;
    canRequestNext: boolean;
    generatedCount: number;
    remaining: number;
    maximum: number;
    openQuestion: boolean;
    disclosure: string;
  };
  evidence: Array<{
    id: string;
    title: string;
    evidenceType: string;
    sourceUrl: string;
    candidateStatement: string;
    fileName: string;
    fileMimeType: string;
    fileSizeBytes: number;
    scanState: string;
    fileAvailable: boolean;
    transcriptionRequested: boolean;
    transcriptionState: string;
    transcript: string;
    status: string;
    canWithdraw: boolean;
    createdAt: string | null;
  }>;
  scheduling: SchedulingRecord[];
  trials: TrialRecord[];
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    createdAt: string | null;
  }>;
};

type TrialRecord = {
  id: string;
  version: number;
  status: string;
  title: string;
  question: string;
  durationDays: number;
  compensationAmountMinor: number;
  compensationCurrency: string;
  compensationTerms: string;
  agreementReference: string;
  jurisdiction: string;
  inputsSupport: string[];
  requiredOutputs: string[];
  scorecard: Array<{
    dimension: string;
    successAnchor: string;
    weight: number;
  }>;
  constraints: string[];
  observationPoints: string[];
  reviewAt: string | null;
  outcomeCriteria: Record<string, string>;
  candidateInstructions: string;
  candidateAcceptance: string;
  candidateSubmission: string;
  candidateEvidenceIds: string[];
  candidateFeedback: string;
  outcome: string;
  canRespond: boolean;
  canSubmit: boolean;
};

type SchedulingRecord = {
  id: string;
  kind: string;
  status: string;
  proposedSlots: string[];
  selectedSlot: string;
  durationMinutes: number;
  schedulingUrl: string;
  teamNote: string;
  candidateTimezone: string;
  candidateAvailability: string;
  candidateMessage: string;
  canRespond: boolean;
  calendarConfirmed: boolean;
};

type Intake = {
  preferredName: string;
  phone: string;
  location: string;
  availability: string;
  resumeUrl: string;
  portfolioUrl: string;
  answers: Record<string, string>;
};

function tokenFromPath(): string {
  return decodeURIComponent(
    window.location.pathname.split("/").filter(Boolean).at(-1) || "",
  );
}

async function portalRequest<T>(
  token: string,
  path = "",
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(
    `/api/eos/talent-portal/${encodeURIComponent(token)}${path}`,
    {
      method,
      credentials: "omit",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      referrerPolicy: "no-referrer",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.message ||
        "The candidate workspace could not complete that action.",
    );
  }
  return (await response.json()) as T;
}

async function portalFileUpload(
  token: string,
  file: File,
  title: string,
  evidenceType: string,
  transcribe = false,
): Promise<PortalView> {
  const query = new URLSearchParams({
    title,
    evidenceType,
    fileName: file.name,
    transcribe: String(transcribe),
  });
  const response = await fetch(
    `/api/eos/talent-portal/${encodeURIComponent(token)}/evidence/files?${query}`,
    {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
      referrerPolicy: "no-referrer",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "The file could not be uploaded.");
  }
  return (await response.json()) as PortalView;
}

function humanState(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CandidatePortalPage() {
  const token = useMemo(tokenFromPath, []);
  const { toast } = useToast();
  const [view, setView] = useState<PortalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [intake, setIntake] = useState<Intake>({
    preferredName: "",
    phone: "",
    location: "",
    availability: "",
    resumeUrl: "",
    portfolioUrl: "",
    answers: { motivation: "", relevantWork: "" },
  });
  const [summary, setSummary] = useState("");
  const [consentScope, setConsentScope] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, string>>({});
  const [assessmentConsent, setAssessmentConsent] = useState<
    Record<string, boolean>
  >({});
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState("portfolio_link");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceStatement, setEvidenceStatement] = useState("");
  const [fileEvidenceTitle, setFileEvidenceTitle] = useState("");
  const [fileEvidenceType, setFileEvidenceType] = useState("resume_file");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [correction, setCorrection] = useState("");
  const [terminalMessage, setTerminalMessage] = useState("");

  useEffect(() => {
    document.title = "Candidate workspace · EntrepreneurOS";
    let referrer = document.querySelector(
      'meta[name="referrer"]',
    ) as HTMLMetaElement | null;
    if (!referrer) {
      referrer = document.createElement("meta");
      referrer.name = "referrer";
      document.head.appendChild(referrer);
    }
    referrer.content = "no-referrer";
    let robots = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex,nofollow,noarchive";
  }, []);

  useEffect(() => {
    void portalRequest<PortalView>(token)
      .then((data) => {
        setView(data);
        setIntake({
          ...data.application.intake,
          answers: {
            motivation: "",
            relevantWork: "",
            ...data.application.intake.answers,
          },
        });
        setSummary(data.application.summary);
        setConsentScope(data.application.consentScope);
        setSubmissions(
          Object.fromEntries(
            data.assessments.map((item) => [
              item.id,
              item.candidateSubmission || "",
            ]),
          ),
        );
      })
      .catch((failure) =>
        setError(
          failure instanceof Error
            ? failure.message
            : "This candidate link is unavailable.",
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const run = async (
    key: string,
    action: () => Promise<PortalView | { message: string }>,
    success: string,
  ) => {
    setBusy(key);
    try {
      const result = await action();
      if ("application" in result) setView(result);
      else setTerminalMessage(result.message);
      toast({ title: success });
    } catch (failure) {
      toast({
        title: "Action not completed",
        description:
          failure instanceof Error ? failure.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy("");
    }
  };
  const intakePayload = { ...intake, candidateSummary: summary, consentScope };
  const intakeEditable = Boolean(view?.application.actions.canEditIntake);
  const toggleConsent = (scope: string) =>
    setConsentScope((current) =>
      current.includes(scope)
        ? current.filter((item) => item !== scope)
        : [...current, scope],
    );

  if (loading)
    return (
      <PortalShell>
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Opening your secure candidate workspace…
        </div>
      </PortalShell>
    );
  if (error)
    return (
      <PortalShell>
        <Alert variant="destructive" className="mx-auto mt-16 max-w-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Candidate workspace unavailable</AlertTitle>
          <AlertDescription>
            {error} Ask your recruiting contact for a new link if you still need
            access.
          </AlertDescription>
        </Alert>
      </PortalShell>
    );
  if (terminalMessage)
    return (
      <PortalShell>
        <Card className="mx-auto mt-16 max-w-xl">
          <CardHeader>
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle>Request recorded</CardTitle>
            <CardDescription>{terminalMessage}</CardDescription>
          </CardHeader>
        </Card>
      </PortalShell>
    );
  if (!view) return null;

  return (
    <PortalShell companyName={view.company.name}>
      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
        <section className="grid gap-4 rounded-3xl bg-gradient-to-br from-violet-700 to-fuchsia-600 p-6 text-white shadow-lg sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
              Candidate workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Welcome, {view.candidate.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              One private place for your intake, evidence, assessments,
              progress, and corrections.
            </p>
          </div>
          <Badge className="w-fit border-white/20 bg-white/15 px-3 py-1 text-white hover:bg-white/15">
            {humanState(view.application.status)}
          </Badge>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-5 w-5 text-primary" />
                  {view.opportunity.title}
                </CardTitle>
                <CardDescription>
                  The current opportunity and observable outcomes—not a hidden
                  score.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {view.opportunity.outcomes.length ? (
                  <ul className="space-y-2 text-sm">
                    {view.opportunity.outcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The team is still refining the role outcomes.
                  </p>
                )}
                {view.application.plausibleRoles.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Plausible roles under consideration
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {view.application.plausibleRoles.map((role) => (
                        <Badge key={role} variant="secondary">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Guided intake</CardTitle>
                <CardDescription>
                  {intakeEditable
                    ? "Save as you go. Submission requires application-processing consent."
                    : "Your intake is locked for review. Use the correction path below if a fact is wrong."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    aria-label="Preferred name"
                    placeholder="Preferred name"
                    value={intake.preferredName}
                    disabled={!intakeEditable}
                    onChange={(event) =>
                      setIntake({
                        ...intake,
                        preferredName: event.target.value,
                      })
                    }
                  />
                  <Input
                    aria-label="Phone"
                    placeholder="Phone (optional)"
                    value={intake.phone}
                    disabled={!intakeEditable}
                    onChange={(event) =>
                      setIntake({ ...intake, phone: event.target.value })
                    }
                  />
                  <Input
                    aria-label="Location"
                    placeholder="Location or time zone"
                    value={intake.location}
                    disabled={!intakeEditable}
                    onChange={(event) =>
                      setIntake({ ...intake, location: event.target.value })
                    }
                  />
                  <Input
                    aria-label="Availability"
                    placeholder="Availability"
                    value={intake.availability}
                    disabled={!intakeEditable}
                    onChange={(event) =>
                      setIntake({ ...intake, availability: event.target.value })
                    }
                  />
                  <Input
                    aria-label="Resume URL"
                    placeholder="https://… resume link"
                    value={intake.resumeUrl}
                    disabled={!intakeEditable}
                    onChange={(event) =>
                      setIntake({ ...intake, resumeUrl: event.target.value })
                    }
                  />
                  <Input
                    aria-label="Portfolio URL"
                    placeholder="https://… portfolio link"
                    value={intake.portfolioUrl}
                    disabled={!intakeEditable}
                    onChange={(event) =>
                      setIntake({ ...intake, portfolioUrl: event.target.value })
                    }
                  />
                </div>
                <Textarea
                  aria-label="Candidate summary"
                  placeholder="A short factual summary of your experience and what you want to contribute"
                  value={summary}
                  disabled={!intakeEditable}
                  onChange={(event) => setSummary(event.target.value)}
                />
                <Textarea
                  aria-label="Candidate motivation"
                  placeholder="Why does this opportunity interest you?"
                  value={intake.answers.motivation || ""}
                  disabled={!intakeEditable}
                  onChange={(event) =>
                    setIntake({
                      ...intake,
                      answers: {
                        ...intake.answers,
                        motivation: event.target.value,
                      },
                    })
                  }
                />
                <Textarea
                  aria-label="Relevant work"
                  placeholder="Describe the most relevant work you have done"
                  value={intake.answers.relevantWork || ""}
                  disabled={!intakeEditable}
                  onChange={(event) =>
                    setIntake({
                      ...intake,
                      answers: {
                        ...intake.answers,
                        relevantWork: event.target.value,
                      },
                    })
                  }
                />
                <div className="rounded-2xl bg-muted/70 p-4">
                  <p className="text-sm font-medium">Consent choices</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose what may be used in this process. You can withdraw
                    later.
                  </p>
                  <div className="mt-3 grid gap-2">
                    {[
                      ["application", "Process my application"],
                      [
                        "job_relevant_assessment",
                        "Use job-relevant assessment submissions",
                      ],
                      [
                        "placement_review",
                        "Use my evidence in placement review",
                      ],
                    ].map(([scope, label]) => (
                      <label
                        key={scope}
                        className="flex items-center gap-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={consentScope.includes(scope)}
                          disabled={!intakeEditable}
                          onChange={() => toggleConsent(scope)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                {intakeEditable && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(
                          "save",
                          () =>
                            portalRequest(
                              token,
                              "/intake",
                              "PATCH",
                              intakePayload,
                            ),
                          "Intake saved",
                        )
                      }
                    >
                      {busy === "save" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      )}
                      Save progress
                    </Button>
                    <Button
                      disabled={
                        Boolean(busy) ||
                        !consentScope.includes("application") ||
                        summary.trim().length < 20
                      }
                      onClick={() =>
                        run(
                          "submit",
                          () =>
                            portalRequest(
                              token,
                              "/intake/submit",
                              "POST",
                              intakePayload,
                            ),
                          "Intake submitted",
                        )
                      }
                    >
                      {busy === "submit" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Submit intake
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {view.scheduling.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Schedule the next step</CardTitle>
                  <CardDescription>
                    Choose a proposed time, request alternatives, or decline. An
                    accepted time is not shown as booked until the team confirms
                    its calendar provider.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {view.scheduling.map((item) => (
                    <SchedulingResponseCard
                      key={item.id}
                      item={item}
                      token={token}
                      busy={busy}
                      run={run}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {view.trials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Paid trial workspace</CardTitle>
                  <CardDescription>
                    A bounded, compensated way to test one real uncertainty. The
                    terms, decision rights, evidence, and human review standard
                    stay visible before you choose.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {view.trials.map((trial) => (
                    <TrialResponseCard
                      key={trial.id}
                      trial={trial}
                      evidence={view.evidence}
                      token={token}
                      busy={busy}
                      run={run}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Assessment center</CardTitle>
                <CardDescription>
                  Only assigned, job-relevant requests appear here. Human
                  reviewers—not an automatic rejection system—make consequential
                  decisions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdaptiveQuestionControl
                  token={token}
                  state={view.adaptiveQuestioning}
                  onComplete={setView}
                />
                {view.assessments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No assessment is assigned right now.
                  </p>
                ) : (
                  view.assessments
                    .filter((item) => item.status !== "closed")
                    .map((item) => (
                      <div key={item.id} className="rounded-2xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{item.title}</p>
                              {item.adaptive && (
                                <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">
                                  Adaptive follow-up {item.generatedSequence}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.candidateBurden ||
                                "Expected effort will be clarified before action."}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {humanState(item.status)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-start gap-2">
                          <p className="flex-1 text-sm">
                            {item.decisionQuestion}
                          </p>
                          {item.decisionQuestion && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Listen to ${item.title}`}
                              title="Read this question aloud on this device"
                              onClick={() =>
                                speakOnDevice(item.decisionQuestion)
                              }
                            >
                              <Volume2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {item.evidenceExpected && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Expected evidence: {item.evidenceExpected}
                          </p>
                        )}
                        {item.adaptive && item.roleHypotheses.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.roleHypotheses.map((role) => (
                              <Badge key={role} variant="secondary">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {item.actionRequired && (
                          <div className="mt-4 space-y-3">
                            <Textarea
                              aria-label={`${item.title} response`}
                              placeholder="Your response or evidence context"
                              value={submissions[item.id] || ""}
                              onChange={(event) =>
                                setSubmissions({
                                  ...submissions,
                                  [item.id]: event.target.value,
                                })
                              }
                            />
                            {item.consentRequired && (
                              <label className="flex items-start gap-2 text-sm">
                                <input
                                  className="mt-1"
                                  type="checkbox"
                                  checked={assessmentConsent[item.id] || false}
                                  onChange={(event) =>
                                    setAssessmentConsent({
                                      ...assessmentConsent,
                                      [item.id]: event.target.checked,
                                    })
                                  }
                                />
                                <span>
                                  I consent to this assessment being used for
                                  the stated job-relevant purpose.
                                </span>
                              </label>
                            )}
                            <Button
                              size="sm"
                              disabled={
                                Boolean(busy) ||
                                !(submissions[item.id] || "").trim() ||
                                (item.consentRequired &&
                                  !assessmentConsent[item.id])
                              }
                              onClick={() =>
                                run(
                                  `assessment:${item.id}`,
                                  () =>
                                    portalRequest(
                                      token,
                                      `/assessments/${item.id}`,
                                      "PATCH",
                                      {
                                        submission: submissions[item.id],
                                        consentAcknowledged:
                                          assessmentConsent[item.id] || false,
                                      },
                                    ),
                                  "Assessment submitted",
                                )
                              }
                            >
                              {busy === `assessment:${item.id}` ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="mr-2 h-4 w-4" />
                              )}
                              Submit response
                            </Button>
                          </div>
                        )}
                        {item.status === "submitted" && (
                          <p className="mt-3 text-sm text-emerald-700">
                            Submitted for human verification and review.
                          </p>
                        )}
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evidence</CardTitle>
                <CardDescription>
                  Record a voice response, upload a file, submit an HTTPS
                  reference, or add a factual statement. Files remain
                  quarantined until a security scanner clears them; all material
                  remains candidate-provided until a human verifies it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <VoiceEvidenceRecorder
                  token={token}
                  canSubmit={view.application.actions.canSubmitEvidence}
                  voiceConsentActive={view.application.consentScope.includes(
                    "voice_processing",
                  )}
                  onComplete={setView}
                />
                <div className="rounded-2xl border p-4">
                  <p className="text-sm font-semibold">Upload a file</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, PNG, JPEG, or UTF-8 text · maximum 10 MB
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="File evidence title"
                      placeholder="Evidence title"
                      value={fileEvidenceTitle}
                      onChange={(event) =>
                        setFileEvidenceTitle(event.target.value)
                      }
                    />
                    <select
                      aria-label="File evidence type"
                      value={fileEvidenceType}
                      onChange={(event) =>
                        setFileEvidenceType(event.target.value)
                      }
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="resume_file">Résumé file</option>
                      <option value="portfolio_file">Portfolio file</option>
                      <option value="work_sample_file">Work sample file</option>
                      <option value="assessment_file">Assessment file</option>
                      <option value="other_file">Other file</option>
                    </select>
                  </div>
                  <Input
                    className="mt-3"
                    aria-label="Choose evidence file"
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,text/plain,.pdf,.png,.jpg,.jpeg,.txt"
                    onChange={(event) =>
                      setEvidenceFile(event.target.files?.[0] || null)
                    }
                  />
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled={
                      Boolean(busy) ||
                      !view.application.actions.canSubmitEvidence ||
                      fileEvidenceTitle.trim().length < 2 ||
                      !evidenceFile ||
                      evidenceFile.size > 10 * 1024 * 1024
                    }
                    onClick={() =>
                      run(
                        "evidence-file",
                        async () => {
                          if (!evidenceFile)
                            throw new Error("Choose a file first.");
                          const result = await portalFileUpload(
                            token,
                            evidenceFile,
                            fileEvidenceTitle,
                            fileEvidenceType,
                          );
                          setFileEvidenceTitle("");
                          setEvidenceFile(null);
                          return result;
                        },
                        "File received securely",
                      )
                    }
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    Upload file
                  </Button>
                </div>
                <div className="border-t pt-5">
                  <p className="text-sm font-semibold">
                    Add a link or statement
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Evidence title"
                      placeholder="Evidence title"
                      value={evidenceTitle}
                      onChange={(event) => setEvidenceTitle(event.target.value)}
                    />
                    <select
                      aria-label="Evidence type"
                      value={evidenceType}
                      onChange={(event) => setEvidenceType(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="portfolio_link">Portfolio link</option>
                      <option value="resume_link">Résumé link</option>
                      <option value="work_sample_link">Work sample link</option>
                      <option value="reference_link">Reference link</option>
                      <option value="candidate_statement">
                        Candidate statement
                      </option>
                      <option value="other_link">Other link</option>
                    </select>
                  </div>
                  <Input
                    className="mt-3"
                    aria-label="Evidence URL"
                    placeholder="https://… (optional)"
                    value={evidenceUrl}
                    onChange={(event) => setEvidenceUrl(event.target.value)}
                  />
                  <Textarea
                    className="mt-3"
                    aria-label="Evidence statement"
                    placeholder="Context or factual statement (optional when a link is supplied)"
                    value={evidenceStatement}
                    onChange={(event) =>
                      setEvidenceStatement(event.target.value)
                    }
                  />
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled={
                      Boolean(busy) ||
                      !view.application.actions.canSubmitEvidence ||
                      evidenceTitle.trim().length < 2 ||
                      (!evidenceUrl.trim() && !evidenceStatement.trim())
                    }
                    onClick={() =>
                      run(
                        "evidence",
                        async () => {
                          await portalRequest(token, "/evidence", "POST", {
                            title: evidenceTitle,
                            evidenceType,
                            sourceUrl: evidenceUrl,
                            candidateStatement: evidenceStatement,
                          });
                          const refreshed =
                            await portalRequest<PortalView>(token);
                          setEvidenceTitle("");
                          setEvidenceUrl("");
                          setEvidenceStatement("");
                          return refreshed;
                        },
                        "Evidence submitted",
                      )
                    }
                  >
                    <FileCheck2 className="mr-2 h-4 w-4" />
                    Submit evidence
                  </Button>
                </div>
                <div className="space-y-2">
                  {view.evidence.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {humanState(item.evidenceType)} ·{" "}
                          {humanState(item.status)}
                          {item.fileName
                            ? ` · ${item.fileName} · ${Math.max(1, Math.ceil(item.fileSizeBytes / 1024))} KB`
                            : ""}
                        </p>
                        {item.fileName && (
                          <p
                            className={`mt-1 text-xs ${item.scanState === "clean" ? "text-emerald-700" : item.scanState === "infected" || item.scanState === "failed" ? "text-destructive" : "text-amber-700"}`}
                          >
                            {item.scanState === "clean"
                              ? "Security scan passed"
                              : item.scanState === "infected"
                                ? "File blocked by security scan"
                                : item.scanState === "failed"
                                  ? "Security scan needs staff attention"
                                  : "Security scan pending"}
                          </p>
                        )}
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            rel="noreferrer"
                            target="_blank"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary"
                          >
                            Open reference <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {item.fileAvailable && (
                          <a
                            href={`/api/eos/talent-portal/${encodeURIComponent(token)}/evidence/${item.id}/file`}
                            className="mt-1 block text-xs text-primary"
                          >
                            Download file
                          </a>
                        )}
                        {item.transcriptionRequested && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Transcription: {humanState(item.transcriptionState)}
                          </p>
                        )}
                        {item.transcript && (
                          <div className="mt-2 max-w-2xl rounded-xl bg-muted/60 p-3 text-sm">
                            <p className="mb-1 text-xs font-semibold text-muted-foreground">
                              Machine transcript — request a correction if it is
                              inaccurate
                            </p>
                            {item.transcript}
                          </div>
                        )}
                      </div>
                      {item.canWithdraw && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            run(
                              `evidence:${item.id}`,
                              async () => {
                                await portalRequest(
                                  token,
                                  `/evidence/${item.id}/withdraw`,
                                  "POST",
                                  {},
                                );
                                return await portalRequest<PortalView>(token);
                              },
                              "Evidence withdrawn",
                            )
                          }
                        >
                          Withdraw
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Questions for the team</CardTitle>
                <CardDescription>
                  Ask about the company, opportunity, or process. Replies stay
                  in this private thread.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {view.messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No messages yet.
                    </p>
                  ) : (
                    view.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${message.direction === "candidate_to_team" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}
                      >
                        <p>{message.body}</p>
                        {message.createdAt && (
                          <p
                            className={`mt-1 text-[11px] ${message.direction === "candidate_to_team" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                          >
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <Textarea
                  aria-label="Question for the recruiting team"
                  placeholder="Ask a question about the company, opportunity, or process"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={Boolean(busy) || question.trim().length < 2}
                  onClick={() =>
                    run(
                      "question",
                      async () => {
                        const result = await portalRequest<PortalView>(
                          token,
                          "/messages",
                          "POST",
                          { message: question },
                        );
                        setQuestion("");
                        return result;
                      },
                      "Question sent",
                    )
                  }
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send question
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request a factual correction</CardTitle>
                <CardDescription>
                  Tell the human review team when a stored or inferred fact is
                  wrong. This opens an attributable review instead of silently
                  rewriting the record.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  aria-label="Correction request"
                  placeholder="Describe the fact to correct and the accurate replacement"
                  value={correction}
                  onChange={(event) => setCorrection(event.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={Boolean(busy) || correction.trim().length < 3}
                  onClick={() =>
                    run(
                      "correction",
                      () =>
                        portalRequest(token, "/corrections", "POST", {
                          correction,
                        }),
                      "Correction requested",
                    )
                  }
                >
                  <Send className="mr-2 h-4 w-4" />
                  Request correction
                </Button>
                {view.application.correctionStatus !== "none" && (
                  <p className="text-sm text-muted-foreground">
                    Correction status:{" "}
                    {humanState(view.application.correctionStatus)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-medium">
                  {view.application.nextAction}
                </p>
                <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                  <p className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Consequential decisions require an authorized human.
                  </p>
                  <p className="flex gap-2">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    You cannot see internal notes, scores, compensation
                    strategy, or private deliberation.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Your data controls</CardTitle>
                <CardDescription>
                  Consent: {humanState(view.application.consentState)}
                  {view.application.retentionUntil
                    ? ` · Current retention review date ${new Date(view.application.retentionUntil).toLocaleDateString()}`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {view.adaptiveQuestioning.consentActive && (
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run(
                        "adaptive-consent-withdraw",
                        () =>
                          portalRequest(
                            token,
                            "/adaptive-questions/consent/withdraw",
                            "POST",
                            {},
                          ),
                        "Adaptive questioning stopped",
                      )
                    }
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Stop adaptive AI questions
                  </Button>
                )}
                {view.application.consentScope.includes("voice_processing") && (
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      run(
                        "voice-consent-withdraw",
                        () =>
                          portalRequest(
                            token,
                            "/voice-consent/withdraw",
                            "POST",
                            {},
                          ),
                        "Voice processing consent withdrawn",
                      )
                    }
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Remove voice transcripts
                  </Button>
                )}
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Withdraw consent and revoke this link? The team may retain records where legally required.",
                      )
                    )
                      void run(
                        "consent",
                        () =>
                          portalRequest(token, "/consent/withdraw", "POST", {
                            reason: "Candidate initiated",
                          }),
                        "Consent withdrawn",
                      );
                  }}
                >
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  Withdraw consent
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Withdraw this application and revoke this link?",
                      )
                    )
                      void run(
                        "withdraw",
                        () =>
                          portalRequest(token, "/withdraw", "POST", {
                            reason: "Candidate initiated",
                          }),
                        "Application withdrawn",
                      );
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Withdraw application
                </Button>
                <Button
                  className="w-full justify-start text-destructive hover:text-destructive"
                  variant="outline"
                  disabled={
                    Boolean(busy) ||
                    Boolean(view.application.deletionRequestedAt)
                  }
                  onClick={() =>
                    run(
                      "delete",
                      () =>
                        portalRequest(token, "/deletion-request", "POST", {}),
                      "Deletion request recorded",
                    )
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {view.application.deletionRequestedAt
                    ? "Deletion requested"
                    : "Request deletion review"}
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </PortalShell>
  );
}

function speakOnDevice(text: string): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function AdaptiveQuestionControl({
  token,
  state,
  onComplete,
}: {
  token: string;
  state: PortalView["adaptiveQuestioning"];
  onComplete: (view: PortalView) => void;
}) {
  const { toast } = useToast();
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestNext = async () => {
    setBusy(true);
    try {
      const result = await portalRequest<PortalView>(
        token,
        "/adaptive-questions/next",
        "POST",
        { consented: true },
      );
      onComplete(result);
      setConsentAcknowledged(false);
      toast({ title: "Your next question is ready" });
    } catch (failure) {
      toast({
        title: "Question not prepared",
        description:
          failure instanceof Error ? failure.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Choose adaptive follow-ups</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {state.disclosure}
          </p>
        </div>
      </div>
      {!state.consentActive && state.canRequestNext && (
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            checked={consentAcknowledged}
            onChange={(event) => setConsentAcknowledged(event.target.checked)}
          />
          <span>
            I consent to this limited AI processing and understand I can stop
            future adaptive questions at any time.
          </span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {state.openQuestion
            ? "Answer the open follow-up before requesting another."
            : state.remaining === 0
              ? `All ${state.maximum} optional follow-ups have been used.`
              : `${state.remaining} of ${state.maximum} optional follow-ups remain.`}
        </p>
        <Button
          size="sm"
          disabled={
            busy ||
            !state.canRequestNext ||
            (!state.consentActive && !consentAcknowledged)
          }
          onClick={() => void requestNext()}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Ask me the next useful question
        </Button>
      </div>
      {!state.canRequestNext && !state.openQuestion && state.remaining > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          This becomes available after your intake and job-relevant assessment
          consent are recorded.
        </p>
      )}
    </div>
  );
}

function VoiceEvidenceRecorder({
  token,
  canSubmit,
  voiceConsentActive,
  onComplete,
}: {
  token: string;
  canSubmit: boolean;
  voiceConsentActive: boolean;
  onComplete: (view: PortalView) => void;
}) {
  const { toast } = useToast();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [title, setTitle] = useState("Voice response");
  const [transcribe, setTranscribe] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const audioUrl = useMemo(
    () => (audioFile ? URL.createObjectURL(audioFile) : ""),
    [audioFile],
  );

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const stopRecording = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      toast({
        title: "Voice recording unavailable",
        description:
          "Use a current browser or submit a typed response instead.",
        variant: "destructive",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const webm = MediaRecorder.isTypeSupported("audio/webm;codecs=opus");
      const mp4 = MediaRecorder.isTypeSupported("audio/mp4");
      if (!webm && !mp4) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("This browser cannot create a supported audio file.");
      }
      const recorder = new MediaRecorder(stream, {
        mimeType: webm ? "audio/webm;codecs=opus" : "audio/mp4",
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = webm ? "audio/webm" : "audio/mp4";
        const extension = webm ? "webm" : "m4a";
        const blob = new Blob(chunks, { type: mimeType });
        setAudioFile(
          new File([blob], `voice-response-${Date.now()}.${extension}`, {
            type: mimeType,
          }),
        );
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      streamRef.current = stream;
      recorderRef.current = recorder;
      setAudioFile(null);
      setRecording(true);
      recorder.start(1_000);
      timeoutRef.current = window.setTimeout(stopRecording, 5 * 60_000);
    } catch (failure) {
      toast({
        title: "Microphone not started",
        description:
          failure instanceof Error
            ? failure.message
            : "Check browser microphone permission.",
        variant: "destructive",
      });
    }
  };

  const upload = async () => {
    if (!audioFile || !title.trim()) return;
    if (audioFile.size > 10 * 1024 * 1024) {
      toast({
        title: "Recording is too large",
        description: "Record a shorter response under 10 MB.",
        variant: "destructive",
      });
      return;
    }
    if (transcribe && !voiceConsentActive && !consentAcknowledged) {
      toast({
        title: "Voice consent required",
        description: "Review and accept the transcription disclosure first.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      if (transcribe && !voiceConsentActive)
        await portalRequest(token, "/voice-consent", "POST", {
          consented: true,
        });
      const result = await portalFileUpload(
        token,
        audioFile,
        title,
        "voice_response_file",
        transcribe,
      );
      onComplete(result);
      setAudioFile(null);
      setTranscribe(false);
      setConsentAcknowledged(false);
      toast({ title: "Voice evidence received securely" });
    } catch (failure) {
      toast({
        title: "Voice evidence not uploaded",
        description:
          failure instanceof Error ? failure.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4">
      <p className="text-sm font-semibold">Record a voice response</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Optional · maximum 5 minutes and 10 MB. Your microphone stays on this
        device until you choose Upload.
      </p>
      <Input
        className="mt-3"
        aria-label="Voice evidence title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {!recording ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!canSubmit || busy}
            onClick={() => void startRecording()}
          >
            <Mic className="mr-2 h-4 w-4" />
            Start recording
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stopRecording}>
            <Square className="mr-2 h-3.5 w-3.5" />
            Stop recording
          </Button>
        )}
        {audioFile && (
          <Button size="sm" variant="ghost" onClick={() => setAudioFile(null)}>
            Discard
          </Button>
        )}
      </div>
      {audioUrl && (
        <audio className="mt-3 w-full" controls src={audioUrl}>
          <track kind="captions" />
        </audio>
      )}
      {audioFile && (
        <div className="mt-3 space-y-3 rounded-xl bg-muted/60 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={transcribe}
              onChange={(event) => setTranscribe(event.target.checked)}
            />
            <span>
              Create an optional machine transcript after the security scan.
            </span>
          </label>
          {transcribe && !voiceConsentActive && (
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={consentAcknowledged}
                onChange={(event) =>
                  setConsentAcknowledged(event.target.checked)
                }
              />
              <span>
                I consent to EOS sending this security-cleared audio to its
                configured speech provider (currently OpenAI) for transcription.
                I can remove the transcript later and request a factual
                correction.
              </span>
            </label>
          )}
          <Button
            size="sm"
            disabled={busy || !canSubmit || !title.trim()}
            onClick={() => void upload()}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Upload voice response
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Read-aloud buttons use your browser&apos;s speech service; EOS does not
        upload TTS audio.
      </p>
    </div>
  );
}

function TrialResponseCard({
  trial,
  evidence,
  token,
  busy,
  run,
}: {
  trial: TrialRecord;
  evidence: PortalView["evidence"];
  token: string;
  busy: string;
  run: (
    key: string,
    action: () => Promise<PortalView | { message: string }>,
    success: string,
  ) => Promise<void>;
}) {
  const [attested, setAttested] = useState(false);
  const [responseMessage, setResponseMessage] = useState(
    trial.candidateAcceptance || "",
  );
  const [submission, setSubmission] = useState(
    trial.candidateSubmission || "",
  );
  const [evidenceIds, setEvidenceIds] = useState<string[]>(
    trial.candidateEvidenceIds || [],
  );
  const compensation = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: trial.compensationCurrency,
  }).format(trial.compensationAmountMinor / 100);
  const respond = (response: "accept" | "decline") =>
    run(
      `trial-response:${trial.id}`,
      () =>
        portalRequest(token, `/trials/${trial.id}/respond`, "POST", {
          response,
          attested: response === "accept" ? attested : false,
          message: responseMessage,
        }),
      response === "accept" ? "Trial accepted" : "Trial declined",
    );
  const toggleEvidence = (id: string) =>
    setEvidenceIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">{trial.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {trial.durationDays} days · {compensation}
            </p>
          </div>
        </div>
        <Badge variant="outline">{humanState(trial.status)}</Badge>
      </div>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <TrialDetail title="Question" items={[trial.question]} />
        <TrialDetail title="Support provided" items={trial.inputsSupport} />
        <TrialDetail title="Required outputs" items={trial.requiredOutputs} />
        <TrialDetail title="Constraints and decision rights" items={trial.constraints} />
        <TrialDetail title="Observation points" items={trial.observationPoints} />
        <TrialDetail
          title="Review"
          items={[
            trial.reviewAt
              ? new Date(trial.reviewAt).toLocaleString()
              : "Review date pending",
          ]}
        />
      </div>
      <div className="mt-4 rounded-xl bg-white p-3 text-sm">
        <p className="font-semibold">Scorecard visible before you begin</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {trial.scorecard.map((item) => (
            <li key={item.dimension}>
              {item.dimension}: {item.successAnchor}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-xl bg-white p-3 text-sm">
        <p className="font-semibold">Compensation and legal terms</p>
        <p className="mt-1 text-muted-foreground">{trial.compensationTerms}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Agreement: {trial.agreementReference} · Jurisdiction: {trial.jurisdiction}
        </p>
      </div>
      {trial.candidateInstructions && (
        <p className="mt-3 text-sm">{trial.candidateInstructions}</p>
      )}
      {trial.canRespond && (
        <div className="mt-4 space-y-3 border-t border-violet-200 pt-4">
          <Textarea
            aria-label="Trial response message"
            value={responseMessage}
            onChange={(event) => setResponseMessage(event.target.value)}
            placeholder="Optional note for the recruiting team"
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
            />
            <span>
              I understand the outputs, scorecard, constraints, compensation,
              agreement reference, and review date shown above.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={Boolean(busy) || !attested}
              onClick={() => void respond("accept")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept trial
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => void respond("decline")}
            >
              Decline
            </Button>
          </div>
        </div>
      )}
      {trial.status === "accepted" && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm text-muted-foreground">
          You accepted this trial. The team must explicitly start it before the
          submission workspace opens.
        </p>
      )}
      {trial.canSubmit && (
        <div className="mt-4 space-y-3 border-t border-violet-200 pt-4">
          <Textarea
            aria-label="Trial submission summary"
            value={submission}
            onChange={(event) => setSubmission(event.target.value)}
            placeholder="Summarize what you completed, decisions you made, and what the evidence demonstrates"
          />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Attach submitted evidence</p>
            {evidence.filter((item) => item.status === "submitted").length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add evidence in the Evidence center below before submitting the
                trial.
              </p>
            ) : (
              evidence
                .filter((item) => item.status === "submitted")
                .map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={evidenceIds.includes(item.id)}
                      onChange={() => toggleEvidence(item.id)}
                    />
                    <span>{item.title}</span>
                  </label>
                ))
            )}
          </div>
          <Button
            size="sm"
            disabled={
              Boolean(busy) || submission.trim().length < 3 || !evidenceIds.length
            }
            onClick={() =>
              void run(
                `trial-submit:${trial.id}`,
                () =>
                  portalRequest(token, `/trials/${trial.id}/submit`, "POST", {
                    summary: submission,
                    evidenceIds,
                  }),
                "Trial submitted for human review",
              )
            }
          >
            <Send className="mr-2 h-4 w-4" />
            Submit trial
          </Button>
        </div>
      )}
      {["passed", "redirected", "extended", "failed"].includes(trial.status) && (
        <div className="mt-4 rounded-xl bg-white p-3 text-sm">
          <p className="font-semibold">Human-reviewed outcome: {humanState(trial.outcome)}</p>
          <p className="mt-1 text-muted-foreground">{trial.candidateFeedback}</p>
        </div>
      )}
    </section>
  );
}

function TrialDetail({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SchedulingResponseCard({
  item,
  token,
  busy,
  run,
}: {
  item: SchedulingRecord;
  token: string;
  busy: string;
  run: (
    key: string,
    action: () => Promise<PortalView | { message: string }>,
    success: string,
  ) => Promise<void>;
}) {
  const [selectedSlot, setSelectedSlot] = useState(
    item.selectedSlot || item.proposedSlots[0] || "",
  );
  const [timezone, setTimezone] = useState(
    item.candidateTimezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
  );
  const [availability, setAvailability] = useState(
    item.candidateAvailability || "",
  );
  const [message, setMessage] = useState(item.candidateMessage || "");
  const respond = (response: "accept" | "request_alternative" | "decline") =>
    run(
      `schedule:${item.id}`,
      () =>
        portalRequest(token, `/scheduling/${item.id}/respond`, "POST", {
          response,
          selectedSlot: response === "accept" ? selectedSlot : undefined,
          timezone,
          availability,
          message,
        }),
      response === "accept"
        ? "Time accepted"
        : response === "decline"
          ? "Invitation declined"
          : "Alternative requested",
    );
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {humanState(item.kind)} · {item.durationMinutes} minutes
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.teamNote || "Choose the time that works best for you."}
          </p>
        </div>
        <Badge variant="outline">
          {item.calendarConfirmed
            ? "Calendar confirmed"
            : humanState(item.status)}
        </Badge>
      </div>
      {item.status === "accepted" && item.selectedSlot && (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          You accepted {new Date(item.selectedSlot).toLocaleString()}.{" "}
          {item.calendarConfirmed
            ? "The calendar event is confirmed and invitations were sent by Google Calendar."
            : "The team will confirm the calendar booking."}
        </p>
      )}
      {item.canRespond && (
        <div className="mt-4 space-y-3">
          <select
            aria-label={`${humanState(item.kind)} proposed time`}
            value={selectedSlot}
            onChange={(event) => setSelectedSlot(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose a proposed time</option>
            {item.proposedSlots.map((slot) => (
              <option key={slot} value={slot}>
                {new Date(slot).toLocaleString()}
              </option>
            ))}
          </select>
          <Input
            aria-label="Your time zone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="Your time zone"
          />
          <Textarea
            aria-label="Alternative availability"
            value={availability}
            onChange={(event) => setAvailability(event.target.value)}
            placeholder="If these do not work, share dates and time windows that do"
          />
          <Input
            aria-label="Scheduling message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Optional note to the recruiting team"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={Boolean(busy) || !selectedSlot || !timezone}
              onClick={() => void respond("accept")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept time
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy) || !timezone || !availability.trim()}
              onClick={() => void respond("request_alternative")}
            >
              Request alternatives
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={Boolean(busy) || !timezone}
              onClick={() => void respond("decline")}
            >
              Decline
            </Button>
          </div>
        </div>
      )}
      {item.schedulingUrl && (
        <a
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary"
          href={item.schedulingUrl}
          target="_blank"
          rel="noreferrer"
        >
          {item.calendarConfirmed
            ? "Open confirmed calendar event"
            : "Open external scheduling page"}{" "}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function PortalShell({
  children,
  companyName,
}: {
  children: React.ReactNode;
  companyName?: string;
}) {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              EO
            </span>
            <div>
              <p className="text-sm font-semibold">
                {companyName || "EntrepreneurOS"}
              </p>
              <p className="text-xs text-muted-foreground">
                Secure candidate workspace
              </p>
            </div>
          </div>
          <LockKeyhole
            className="h-5 w-5 text-primary"
            aria-label="Private link"
          />
        </div>
      </header>
      {children}
      <footer className="px-4 py-8 text-center text-xs text-muted-foreground">
        Private, candidate-controlled recruiting workspace · Do not forward your
        link.
      </footer>
    </div>
  );
}
