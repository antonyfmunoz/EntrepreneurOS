import { z } from "zod";

export const eosInstrumentKeys = [
  "docs", "files", "sheets", "slides", "tables", "forms", "calendar", "search", "canvas",
  "tasks", "projects", "workflows", "crm", "messages", "conference_rooms", "ai", "knowledge",
  "memory", "analytics", "learning", "progression", "commerce", "finance", "ads", "reputation",
] as const;

export const eosInstrumentKeySchema = z.enum(eosInstrumentKeys);
export type EosInstrumentKey = z.infer<typeof eosInstrumentKeySchema>;

export const eosInstrumentManifest: Record<EosInstrumentKey, {
  label: string;
  objectTypes: readonly string[];
  purpose: string;
}> = {
  docs: { label: "Docs", objectTypes: ["document", "template"], purpose: "Author, review, version, and approve institutional documents." },
  files: { label: "Drive / Files", objectTypes: ["folder", "file", "collection"], purpose: "Organize governed file metadata and immutable storage references." },
  sheets: { label: "Sheets", objectTypes: ["workbook", "worksheet", "table", "chart"], purpose: "Operate structured calculations and tabular models." },
  slides: { label: "Slides", objectTypes: ["deck", "slide", "theme"], purpose: "Build versioned institutional presentations." },
  tables: { label: "Databases / Tables", objectTypes: ["database", "table", "view", "record"], purpose: "Define structured records, fields, views, and governed data collections." },
  forms: { label: "Forms", objectTypes: ["form", "question", "submission"], purpose: "Collect consented structured inputs and route them into governed work." },
  calendar: { label: "Calendar", objectTypes: ["calendar", "event", "availability", "booking"], purpose: "Coordinate accountable time, availability, and commitments." },
  search: { label: "Search", objectTypes: ["index", "saved_search", "result_set"], purpose: "Discover authorized company state with source and freshness context." },
  canvas: { label: "Canvas", objectTypes: ["canvas", "node", "edge", "board"], purpose: "Model visual relationships without replacing canonical records." },
  tasks: { label: "Tasks", objectTypes: ["task", "checklist", "queue"], purpose: "Track bounded work and completion evidence." },
  projects: { label: "Projects", objectTypes: ["project", "milestone", "dependency"], purpose: "Coordinate multi-stage outcomes, dependencies, and milestones." },
  workflows: { label: "Workflows / Automations", objectTypes: ["workflow", "step", "run"], purpose: "Execute durable, idempotent, authority-bound processes." },
  crm: { label: "CRM", objectTypes: ["person", "relationship", "facet", "pipeline", "opportunity"], purpose: "Manage people, relationships, commercial facets, and opportunities." },
  messages: { label: "Messages", objectTypes: ["conversation", "message", "channel", "thread"], purpose: "Preserve hierarchical organizational communication." },
  conference_rooms: { label: "Conference Rooms", objectTypes: ["room", "meeting", "agenda", "participant", "decision"], purpose: "Turn meetings into governed decisions, actions, and evidence." },
  ai: { label: "AI", objectTypes: ["assistant", "agent", "prompt", "evaluation"], purpose: "Operate user-named, authority-bound assistants and role agents." },
  knowledge: { label: "Knowledge", objectTypes: ["source", "article", "topic", "graph"], purpose: "Maintain sourced institutional knowledge distinct from memory." },
  memory: { label: "Memory", objectTypes: ["record", "supersession", "retrieval"], purpose: "Retain reviewed institutional facts, decisions, lessons, patterns, and policy." },
  analytics: { label: "Analytics", objectTypes: ["metric", "dashboard", "report", "observation"], purpose: "Measure outcomes without becoming an undeclared source of truth." },
  learning: { label: "Learning", objectTypes: ["course", "module", "lesson", "enrollment"], purpose: "Deliver governed curricula and retain completion evidence." },
  progression: { label: "Development / Progression", objectTypes: ["role_path", "competency", "assessment", "progression_event"], purpose: "Develop people and agents against explicit role requirements." },
  commerce: { label: "Commerce", objectTypes: ["offer", "order", "subscription", "entitlement"], purpose: "Manage offers, orders, subscriptions, and entitlements." },
  finance: { label: "Finance", objectTypes: ["account", "plan", "transaction", "reconciliation", "obligation"], purpose: "Govern financial sources, plans, flows, reconciliations, and obligations." },
  ads: { label: "Ads", objectTypes: ["account", "campaign", "ad_group", "creative", "audience", "budget", "placement"], purpose: "Control paid-media state, authority, spend, and performance evidence." },
  reputation: { label: "Reputation", objectTypes: ["review", "review_request", "response", "testimonial", "rating_summary"], purpose: "Manage reviews, responses, testimonials, and reputation evidence." },
};

export const eosInstrumentStates = ["draft", "active", "paused", "completed", "cancelled", "archived"] as const;
export const eosInstrumentStateSchema = z.enum(eosInstrumentStates);
export const eosInstrumentClassificationSchema = z.enum(["internal", "confidential", "restricted"]);
export const eosInstrumentVisibilitySchema = z.enum(["seat", "team", "organization", "portfolio"]);

const identifier = z.string().trim().min(2).max(200).regex(/^[a-z0-9][a-z0-9._:-]*$/i);
const evidenceIds = z.array(z.string().uuid()).max(100).default([]);
const jsonRecord = z.record(z.unknown()).default({});

export const instrumentObjectCreateSchema = z.object({
  instrumentKey: eosInstrumentKeySchema,
  objectType: identifier,
  objectKey: identifier,
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().max(5_000).default(""),
  classification: eosInstrumentClassificationSchema.default("confidential"),
  visibility: eosInstrumentVisibilitySchema.default("organization"),
  parentObjectId: z.string().uuid().optional(),
  data: jsonRecord,
  sourceReference: jsonRecord,
  evidenceIds,
  idempotencyKey: identifier,
}).superRefine((value, context) => {
  if (!eosInstrumentManifest[value.instrumentKey].objectTypes.includes(value.objectType))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["objectType"], message: `${value.objectType} is not a canonical ${value.instrumentKey} object type.` });
});

export const instrumentObjectUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(2).max(300).optional(),
  summary: z.string().trim().max(5_000).optional(),
  classification: eosInstrumentClassificationSchema.optional(),
  visibility: eosInstrumentVisibilitySchema.optional(),
  data: z.record(z.unknown()).optional(),
  sourceReference: z.record(z.unknown()).optional(),
  evidenceIds: evidenceIds.optional(),
  idempotencyKey: identifier,
});

export const instrumentTransitionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  state: eosInstrumentStateSchema,
  rationale: z.string().trim().min(3).max(5_000),
  evidenceIds,
  idempotencyKey: identifier,
});

export const instrumentLinkCreateSchema = z.object({
  sourceObjectId: z.string().uuid(),
  targetObjectId: z.string().uuid(),
  relationshipType: identifier,
  metadata: jsonRecord,
  idempotencyKey: identifier,
});

export const instrumentSearchSchema = z.object({
  query: z.string().trim().max(200).default(""),
  instrumentKey: eosInstrumentKeySchema.optional(),
  state: eosInstrumentStateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const instrumentPortableObjectSchema = z.object({
  instrumentKey: eosInstrumentKeySchema,
  objectType: identifier,
  objectKey: identifier,
  title: z.string().trim().min(2).max(300),
  summary: z.string().trim().max(5_000).default(""),
  classification: eosInstrumentClassificationSchema.default("confidential"),
  visibility: eosInstrumentVisibilitySchema.default("organization"),
  data: jsonRecord,
  sourceReference: jsonRecord,
}).superRefine((value, context) => {
  if (!eosInstrumentManifest[value.instrumentKey].objectTypes.includes(value.objectType))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["objectType"], message: `${value.objectType} is not a canonical ${value.instrumentKey} object type.` });
});

const portableObjectReferenceSchema = z.object({ instrumentKey: eosInstrumentKeySchema, objectKey: identifier });
export const instrumentPortableBundleSchema = z.object({
  schemaVersion: z.literal("eos.instrument-bundle.v1"),
  exportedAt: z.string().datetime().optional(),
  objects: z.array(instrumentPortableObjectSchema).min(1).max(100),
  links: z.array(z.object({
    source: portableObjectReferenceSchema,
    target: portableObjectReferenceSchema,
    relationshipType: identifier,
    metadata: jsonRecord,
  })).max(500).default([]),
}).superRefine((bundle, context) => {
  const keys = new Set<string>();
  for (let index = 0; index < bundle.objects.length; index += 1) {
    const object = bundle.objects[index];
    const key = `${object.instrumentKey}:${object.objectKey}`;
    if (keys.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["objects", index, "objectKey"], message: "Portable object keys must be unique within an instrument bundle." });
    keys.add(key);
  }
  for (let index = 0; index < bundle.links.length; index += 1) {
    const link = bundle.links[index];
    const sourceKey = `${link.source.instrumentKey}:${link.source.objectKey}`;
    const targetKey = `${link.target.instrumentKey}:${link.target.objectKey}`;
    if (!keys.has(sourceKey)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["links", index, "source"], message: "Portable links must reference a source object contained in the bundle." });
    if (!keys.has(targetKey)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["links", index, "target"], message: "Portable links must reference a target object contained in the bundle." });
  }
});

export const instrumentImportSchema = z.object({
  bundle: instrumentPortableBundleSchema,
  conflictStrategy: z.enum(["skip_existing", "copy"]).default("skip_existing"),
  idempotencyKey: identifier,
});

export const instrumentTransitions: Record<(typeof eosInstrumentStates)[number], readonly (typeof eosInstrumentStates)[number][]> = {
  draft: ["active", "cancelled", "archived"],
  active: ["paused", "completed", "cancelled", "archived"],
  paused: ["active", "cancelled", "archived"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

// Drafts may be intentionally incomplete. Activation is the semantic boundary
// at which each object must satisfy its canonical minimum grammar. Dot paths
// keep the contract machine-readable for API validation, UI guidance, package
// compilation, and acceptance reporting without pretending every instrument
// has the same domain fields.
export const instrumentActivationRequirements: Partial<Record<EosInstrumentKey, Record<string, readonly string[]>>> = {
  docs: { document: ["body", "format"], template: ["body", "variables"] },
  files: { folder: ["path"], file: ["storageReference", "mimeType"], collection: ["memberObjectIds"] },
  sheets: { workbook: ["worksheets"], worksheet: ["columns", "rows"], table: ["columns", "rows"], chart: ["chartType", "dataRange"] },
  slides: { deck: ["slides"], slide: ["layout", "content"], theme: ["tokens"] },
  tables: { database: ["fields"], table: ["fields"], view: ["sourceObjectId", "configuration"], record: ["values"] },
  forms: { form: ["questions", "consentVersion"], question: ["questionType", "prompt"], submission: ["formObjectId", "responses", "submittedAt"] },
  calendar: { calendar: ["timeZone"], event: ["startsAt", "endsAt", "participantReferences"], availability: ["timeZone", "windows"], booking: ["eventObjectId", "bookedByReference"] },
  search: { index: ["sourceInstrumentKeys"], saved_search: ["query"], result_set: ["query", "resultObjectIds", "generatedAt"] },
  canvas: { canvas: ["nodes", "edges"], node: ["sourceObjectId", "position"], edge: ["sourceNodeId", "targetNodeId"], board: ["canvasObjectId"] },
  tasks: { task: ["objective", "ownerSeatId"], checklist: ["items"], queue: ["selectionRule"] },
  projects: { project: ["objective", "ownerSeatId"], milestone: ["projectObjectId", "targetAt"], dependency: ["predecessorObjectId", "successorObjectId"] },
  workflows: { workflow: ["steps"], step: ["action", "authorityClass"], run: ["workflowObjectId", "startedAt"] },
  crm: { person: ["displayName"], relationship: ["personObjectId", "relationshipType"], facet: ["personObjectId", "facetType"], pipeline: ["stages"], opportunity: ["relationshipObjectId", "stage"] },
  messages: { conversation: ["participantSeatIds"], message: ["conversationObjectId", "body"], channel: ["channelType"], thread: ["conversationObjectId"] },
  conference_rooms: { room: ["roomType", "accessRule"], meeting: ["startsAt", "endsAt", "participantSeatIds", "agenda"], agenda: ["meetingObjectId", "items"], participant: ["meetingObjectId", "seatId"], decision: ["meetingObjectId", "decision", "decidedBySeatId"] },
  ai: { assistant: ["name", "principalSeatId"], agent: ["seatId", "operatingMode"], prompt: ["purpose", "template"], evaluation: ["subjectObjectId", "outcome"] },
  knowledge: { source: ["sourceReference", "sourceType"], article: ["body", "sourceObjectIds"], topic: ["name"], graph: ["nodes", "edges"] },
  memory: { record: ["content", "sourceObjectIds"], supersession: ["priorObjectId", "replacementObjectId"], retrieval: ["query", "resultObjectIds"] },
  analytics: { metric: ["definition", "formula", "sourceObjectIds"], dashboard: ["metricObjectIds"], report: ["periodStart", "periodEnd", "metricObjectIds"], observation: ["metricObjectId", "value", "observedAt"] },
  learning: { course: ["modules"], module: ["lessons"], lesson: ["content"], enrollment: ["courseObjectId", "subjectSeatId"] },
  progression: { role_path: ["roleKey", "competencies"], competency: ["name", "levels"], assessment: ["subjectSeatId", "competencyObjectId", "level"], progression_event: ["subjectSeatId", "fromLevel", "toLevel"] },
  commerce: { offer: ["name", "priceMinor", "currency"], order: ["offerObjectId", "buyerReference", "amountMinor"], subscription: ["orderObjectId", "interval"], entitlement: ["subjectReference", "scope"] },
  finance: { account: ["accountType", "currency"], plan: ["periodStart", "periodEnd", "lines"], transaction: ["accountObjectId", "amountMinor", "occurredAt"], reconciliation: ["sourceObjectIds", "evidenceIds"], obligation: ["counterpartyReference", "dueAt", "amountMinor"] },
  ads: { account: ["providerReference", "currency"], campaign: ["objective", "budgetMinor", "currency"], ad_group: ["campaignObjectId", "audienceObjectIds"], creative: ["claim", "assetObjectIds"], audience: ["definition", "sourceObjectIds"], budget: ["campaignObjectId", "limitMinor", "currency"], placement: ["campaignObjectId", "channel"] },
  reputation: { review: ["rating", "sourceReference", "receivedAt"], review_request: ["relationshipObjectId", "channel", "consentReference"], response: ["reviewObjectId", "body", "approvedBySeatId"], testimonial: ["body", "consentReference", "evidenceIds"], rating_summary: ["sourceReviewObjectIds", "averageRating", "generatedAt"] },
};

const dateFieldNames = new Set(["startsAt", "endsAt", "targetAt", "startedAt", "submittedAt", "generatedAt", "observedAt", "occurredAt", "dueAt", "receivedAt", "periodStart", "periodEnd"]);
const numericFieldPattern = /(Minor|Rating|^rating$|^value$|^level$)$/;
const referenceFieldPattern = /(ObjectId|SeatId|Reference)$/;

function starterScalar(path: string): unknown {
  const field = path.split(".").at(-1) || path;
  if (field === "currency") return "USD";
  if (field === "timeZone") return "America/Los_Angeles";
  if (field === "format") return "markdown";
  if (field === "mimeType") return "application/octet-stream";
  if (field === "storageReference") return "vault://replace-with-managed-file-reference";
  if (field === "sourceReference" || field === "providerReference") return { kind: "native_eos", reference: "replace-with-governed-reference" };
  if (field === "position") return { x: 0, y: 0 };
  if (field === "configuration" || field === "definition" || field === "formula" || field === "tokens" || field === "values") return { description: "Define this governed value." };
  if (field === "consentReference") return { status: "required", reference: "replace-with-consent-evidence" };
  if (dateFieldNames.has(field)) {
    const offset = field === "endsAt" || field === "periodEnd" || field === "targetAt" || field === "dueAt" ? 3_600_000 : 0;
    return new Date(Date.now() + offset).toISOString();
  }
  if (numericFieldPattern.test(field)) return field.toLowerCase().includes("rating") ? 5 : 0;
  if (field.endsWith("Ids") || field.endsWith("References") || ["fields", "columns", "rows", "worksheets", "slides", "questions", "responses", "windows", "nodes", "edges", "items", "steps", "stages", "participantSeatIds", "modules", "lessons", "competencies", "levels", "lines"].includes(field)) return ["replace-with-governed-reference"];
  if (referenceFieldPattern.test(field)) return "replace-with-governed-reference";
  if (field === "body" || field === "content" || field === "prompt" || field === "decision" || field === "claim" || field === "objective" || field === "purpose" || field === "agenda") return "Describe the governed content.";
  if (field === "variables") return { example: "replace-with-value" };
  if (field === "accessRule") return "invited_participants";
  if (field === "authorityClass") return "execute";
  if (field === "operatingMode") return "assistant";
  if (field === "roomType") return "virtual";
  if (field === "questionType") return "short_text";
  if (field === "channelType" || field === "channel") return "internal";
  if (field === "chartType") return "bar";
  if (field === "dataRange") return "A1:B2";
  if (field === "layout") return "title_and_body";
  if (field === "interval") return "month";
  if (field === "accountType") return "operating";
  if (field === "relationshipType") return "customer";
  if (field === "facetType") return "commercial";
  if (field === "sourceType") return "native_eos";
  if (field === "stage") return "qualified";
  if (field === "action") return "review";
  if (field === "query") return "Enter a bounded search query";
  if (field === "name" || field === "displayName") return "Untitled";
  if (field === "fromLevel") return "current";
  if (field === "toLevel") return "next";
  if (field === "scope") return "defined_scope";
  if (field === "path") return "/";
  return "Define this governed value.";
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = value;
}

export function instrumentStarterData(instrumentKey: EosInstrumentKey, objectType: string) {
  const data: Record<string, unknown> = {};
  for (const path of instrumentActivationRequirements[instrumentKey]?.[objectType] || []) setPath(data, path, starterScalar(path));
  return data;
}

export type InstrumentFieldKind = "text" | "number" | "datetime" | "json";

export function instrumentFieldKind(path: string, starterValue?: unknown): InstrumentFieldKind {
  const field = path.split(".").at(-1) || path;
  if (dateFieldNames.has(field)) return "datetime";
  if (numericFieldPattern.test(field)) return "number";
  if (starterValue !== null && typeof starterValue === "object") return "json";
  return "text";
}

function pathPresent(value: Record<string, unknown>, path: string) {
  let cursor: unknown = value;
  for (const part of path.split(".")) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !(part in cursor)) return false;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (cursor === null || cursor === undefined || cursor === "") return false;
  if (Array.isArray(cursor)) return cursor.length > 0;
  return true;
}

export function instrumentActivationFindings(instrumentKey: EosInstrumentKey, objectType: string, data: unknown) {
  const record = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
  const required = instrumentActivationRequirements[instrumentKey]?.[objectType] || [];
  return required.filter((path) => !pathPresent(record, path)).map((path) => ({
    code: "instrument_required_field_missing",
    path: `data.${path}`,
    message: `${eosInstrumentManifest[instrumentKey].label} ${objectType.replaceAll("_", " ")} requires ${path} before activation.`,
  }));
}

export function instrumentDomainFindings(instrumentKey: EosInstrumentKey, objectType: string, data: unknown) {
  const record = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
  const findings = [...instrumentActivationFindings(instrumentKey, objectType, data)];
  const required = instrumentActivationRequirements[instrumentKey]?.[objectType] || [];
  for (const path of required) {
    const field = path.split(".").at(-1) || path;
    const value = record[field];
    if (field === "currency" && typeof value === "string" && !/^[A-Z]{3}$/.test(value)) findings.push({ code: "instrument_currency_invalid", path: `data.${path}`, message: "Currency must be a three-letter ISO-style code such as USD." });
    if (numericFieldPattern.test(field) && value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) findings.push({ code: "instrument_number_invalid", path: `data.${path}`, message: `${field} must be a finite number.` });
    if (field.endsWith("Minor") && typeof value === "number" && value < 0) findings.push({ code: "instrument_amount_negative", path: `data.${path}`, message: `${field} cannot be negative.` });
    if ((field === "rating" || field === "averageRating") && typeof value === "number" && (value < 1 || value > 5)) findings.push({ code: "instrument_rating_out_of_range", path: `data.${path}`, message: `${field} must be between 1 and 5.` });
    const starter = starterScalar(path);
    if (Array.isArray(starter) && value !== undefined && !Array.isArray(value)) findings.push({ code: "instrument_array_invalid", path: `data.${path}`, message: `${field} must be a list.` });
  }
  const chronologicalPairs: Array<[string, string]> = [["startsAt", "endsAt"], ["periodStart", "periodEnd"]];
  for (const [startField, endField] of chronologicalPairs) {
    if (typeof record[startField] !== "string" || typeof record[endField] !== "string") continue;
    const start = Date.parse(record[startField] as string);
    const end = Date.parse(record[endField] as string);
    if (!Number.isFinite(start) || !Number.isFinite(end)) findings.push({ code: "instrument_datetime_invalid", path: "data", message: `${startField} and ${endField} must be valid datetimes.` });
    else if (end <= start) findings.push({ code: "instrument_datetime_order_invalid", path: `data.${endField}`, message: `${endField} must be after ${startField}.` });
  }
  return findings;
}

export function mayTransitionInstrumentObject(from: string, to: string): boolean {
  return Boolean(instrumentTransitions[from as keyof typeof instrumentTransitions]?.includes(to as never));
}

export function instrumentManifestProjection() {
  return eosInstrumentKeys.map((key) => ({ key, ...eosInstrumentManifest[key] }));
}
