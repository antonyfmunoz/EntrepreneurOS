// lib/orchestrator/phases/backend-adapter.ts
// Phase 4: backend
//
// Generates Express route handlers, storage methods, and Drizzle table schemas
// for every endpoint in the spec's BackendSpec layer. Each endpoint is one
// work unit.
//
// SCOPING UPDATE (supersedes earlier "does NOT touch server/, shared/, or
// scripts/" rule): this adapter now writes real wiring into the repo inside
// strictly-bounded generated zones:
//
//   - server/generated/routes/{base}.ts       (per endpoint)
//   - server/generated/storage/{entity}.ts    (per entity)
//   - server/generated/schema.ts              (idempotent append)
//   - server/generated/index.ts               (re-exports + registerGeneratedRoutes)
//
// It also performs two idempotent marker injections:
//   - server/routes.ts gets a one-time `__ORCHESTRATOR_GENERATED_ROUTES__`
//     block inside registerRoutes() that dynamically imports and calls
//     registerGeneratedRoutes(app).
//   - shared/schema.ts gets an `__ORCHESTRATOR_GENERATED_SCHEMAS__` marker at
//     the end of the file; generated table definitions are appended after it.
//
// Drizzle migration SQL is written to
// .planning/output/migrations/{timestamp}-{base}.sql (never the real
// migrations/ directory — that is Drizzle Kit's journal).

import fs from "node:fs";
import path from "node:path";
import {
  type ProjectConfig,
} from "../../../shared/design-schema.js";
import type { SpecOutput, BackendEndpointSpec } from "@shared/spec-schema.js";
import { and, eq } from "drizzle-orm";
import { pipelinePages } from "../../../shared/design-schema.js";
import type { PhaseImplementation, PageWorkUnit } from "../phase-runner.js";
import { getOrchestratorDb } from "../db.js";
import {
  generateRouteCode,
  generateStorageCode,
} from "../../backend-wirer/route-generator.js";
import {
  generateSchemaCode,
  generateMigrationSQL,
} from "../../backend-wirer/schema-generator.js";
import type { BackendBrownfieldInventory } from "../../backend-wirer/types.js";

interface BackendRunInput {
  endpoint: BackendEndpointSpec;
  endpointIndex: number;
  tableHints: string[];
  projectRoot: string;
  migrationsDir: string;
}

async function loadLatestSpec(projectId: string): Promise<SpecOutput> {
  const db = getOrchestratorDb();
  const rows = await db
    .select()
    .from(pipelinePages)
    .where(
      and(
        eq(pipelinePages.projectId, projectId),
        eq(pipelinePages.phase, "spec"),
        eq(pipelinePages.status, "complete"),
      ),
    )
    .limit(1);
  if (rows.length === 0 || !rows[0].output) {
    throw new Error(
      `Phase "backend": no completed spec output found for projectId=${projectId}.`,
    );
  }
  return JSON.parse(rows[0].output) as SpecOutput;
}

function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
}

function endpointBasename(endpoint: BackendEndpointSpec): string {
  const method = endpoint.method.toLowerCase();
  const tail = safeFileName(endpoint.path.replace(/^\/+/, "").replace(/\//g, "_"));
  return `${method}_${tail || "root"}`;
}

function toPascal(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join("");
}

function deriveEntityName(endpointPath: string): string {
  const segments = endpointPath.split("/").filter((s) => s && !s.startsWith(":") && s !== "api");
  const last = segments[segments.length - 1] ?? "items";
  return last.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

// Empty inventory — generated routes live in their own files and cannot
// collide with server/routes.ts content.
const EMPTY_INVENTORY: BackendBrownfieldInventory = {
  existingRoutePaths: [],
  existingStorageFunctions: [],
  existingTableNames: [],
  routesInsertionOffset: -1,
  storageInsertionOffset: -1,
  schemaInsertionOffset: -1,
};

// ─── Marker-bounded block helpers ─────────────────────────────────────────────

function replaceOrInsertBlock(
  source: string,
  startMarker: string,
  endMarker: string,
  newBody: string,
): string {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    // Append a fresh block at end
    const prefix = source.endsWith("\n") ? source : source + "\n";
    return `${prefix}${startMarker}\n${newBody}\n${endMarker}\n`;
  }
  const before = source.slice(0, startIdx + startMarker.length);
  const after = source.slice(endIdx);
  return `${before}\n${newBody}\n${after}`;
}

function ensureLine(body: string, line: string): string {
  const lines = body.split("\n").map((l) => l.trimEnd()).filter((l) => l.length > 0);
  if (!lines.includes(line.trim())) lines.push(line.trim());
  return lines.join("\n");
}

function extractBlockBody(source: string, startMarker: string, endMarker: string): string {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return "";
  return source.slice(startIdx + startMarker.length, endIdx).trim();
}

// ─── server/generated/index.ts scaffolding ────────────────────────────────────

const INDEX_IMPORTS_START = "// __GENERATED_ROUTE_IMPORTS__";
const INDEX_IMPORTS_END = "// __GENERATED_ROUTE_IMPORTS_END__";
const INDEX_REGS_START = "// __GENERATED_ROUTE_REGISTRATIONS__";
const INDEX_REGS_END = "// __GENERATED_ROUTE_REGISTRATIONS_END__";

function ensureGeneratedIndex(generatedDir: string): string {
  const indexPath = path.join(generatedDir, "index.ts");
  if (!fs.existsSync(indexPath)) {
    const scaffold = [
      "// AUTO-GENERATED by saas-dev:backend-wirer — do not edit manually",
      `import type { Express } from "express";`,
      "",
      INDEX_IMPORTS_START,
      INDEX_IMPORTS_END,
      "",
      `export function registerGeneratedRoutes(app: Express): void {`,
      `  ${INDEX_REGS_START}`,
      `  ${INDEX_REGS_END}`,
      `}`,
      "",
    ].join("\n");
    fs.writeFileSync(indexPath, scaffold, "utf-8");
  }
  return indexPath;
}

function addRouteToGeneratedIndex(
  indexPath: string,
  baseName: string,
  registerFnName: string,
): void {
  const src = fs.readFileSync(indexPath, "utf-8");
  const importLine = `import { ${registerFnName} } from "./routes/${baseName}.js";`;
  const regLine = `  ${registerFnName}(app);`;

  const currentImports = extractBlockBody(src, INDEX_IMPORTS_START, INDEX_IMPORTS_END);
  const newImports = ensureLine(currentImports, importLine);

  let next = replaceOrInsertBlock(src, INDEX_IMPORTS_START, INDEX_IMPORTS_END, newImports);

  const currentRegs = extractBlockBody(next, INDEX_REGS_START, INDEX_REGS_END);
  const newRegs = ensureLine(currentRegs, regLine);
  next = replaceOrInsertBlock(next, INDEX_REGS_START, INDEX_REGS_END, newRegs);

  fs.writeFileSync(indexPath, next, "utf-8");
}

// ─── server/routes.ts marker injection ────────────────────────────────────────

const ROUTES_MARKER = "// __ORCHESTRATOR_GENERATED_ROUTES__ (do not remove this marker)";

function ensureRoutesMarkerInjected(projectRoot: string): void {
  const routesFile = path.join(projectRoot, "server", "routes.ts");
  if (!fs.existsSync(routesFile)) return;
  const src = fs.readFileSync(routesFile, "utf-8");
  if (src.includes(ROUTES_MARKER)) return;

  // Insert directly before `const httpServer = createServer(app);` inside
  // registerRoutes. That is the documented anchor.
  const anchor = "const httpServer = createServer(app);";
  const anchorIdx = src.indexOf(anchor);
  if (anchorIdx === -1) {
    // Fail loud — caller will see this and can fix the anchor.
    throw new Error(
      `backend-adapter: could not find anchor "${anchor}" in server/routes.ts to inject generated-routes marker.`,
    );
  }
  const injection = [
    ROUTES_MARKER,
    `  {`,
    `    const { registerGeneratedRoutes } = await import("./generated/index.js");`,
    `    await registerGeneratedRoutes(app);`,
    `  }`,
    ``,
    `  `,
  ].join("\n");
  const next = src.slice(0, anchorIdx) + injection + src.slice(anchorIdx);
  fs.writeFileSync(routesFile, next, "utf-8");
}

// ─── shared/schema.ts marker append ───────────────────────────────────────────

const SCHEMA_MARKER = "// __ORCHESTRATOR_GENERATED_SCHEMAS__";

function appendSchemaBlockIdempotent(projectRoot: string, block: string, tableName: string): void {
  const schemaFile = path.join(projectRoot, "shared", "schema.ts");
  if (!fs.existsSync(schemaFile)) return;
  let src = fs.readFileSync(schemaFile, "utf-8");
  if (!src.includes(SCHEMA_MARKER)) {
    const prefix = src.endsWith("\n") ? src : src + "\n";
    src = `${prefix}\n${SCHEMA_MARKER}\n`;
  }
  // Idempotency: if `export const {tableName} = pgTable(` already exists, skip.
  const tableDeclRegex = new RegExp(`export\\s+const\\s+${tableName}\\s*=\\s*pgTable`);
  if (tableDeclRegex.test(src)) {
    fs.writeFileSync(schemaFile, src, "utf-8");
    return;
  }
  const appended = src.endsWith("\n") ? src + "\n" + block + "\n" : src + "\n\n" + block + "\n";
  fs.writeFileSync(schemaFile, appended, "utf-8");
}

// ─── Phase implementation ─────────────────────────────────────────────────────

export const backendPhaseImplementation: PhaseImplementation = {
  async prepare(config: ProjectConfig): Promise<PageWorkUnit[]> {
    const projectRoot = path.resolve(config.repoPath);
    const spec = await loadLatestSpec(config.projectId);

    const backendSpec = spec.backendSpec;
    if (!backendSpec || backendSpec.endpoints.length === 0) {
      throw new Error(
        `Phase "backend": spec.backendSpec is empty. Either the spec phase ` +
          `failed to derive endpoints or the input spec has no backend layer.`,
      );
    }

    const generatedDir = path.join(projectRoot, "server", "generated");
    fs.mkdirSync(path.join(generatedDir, "routes"), { recursive: true });
    fs.mkdirSync(path.join(generatedDir, "storage"), { recursive: true });
    ensureGeneratedIndex(generatedDir);

    const migrationsDir = path.join(projectRoot, ".planning", "output", "migrations");
    fs.mkdirSync(migrationsDir, { recursive: true });

    // Inject the one-time marker into server/routes.ts (idempotent).
    ensureRoutesMarkerInjected(projectRoot);

    return backendSpec.endpoints.map((endpoint, idx) => ({
      pageName: `${endpoint.method} ${endpoint.path}`,
      pageIndex: idx,
      input: {
        endpoint,
        endpointIndex: idx,
        tableHints: backendSpec.drizzleTableHints,
        projectRoot,
        migrationsDir,
      } satisfies BackendRunInput,
    }));
  },

  async runPage(rawInput: unknown, _config: ProjectConfig): Promise<unknown> {
    const input = rawInput as BackendRunInput;
    const { endpoint, projectRoot, migrationsDir } = input;

    const routeBlock = generateRouteCode(endpoint, EMPTY_INVENTORY);
    const storageBlock = generateStorageCode(endpoint);

    const entityName = deriveEntityName(endpoint.path);
    const tableName = entityName;
    const fields = endpoint.requestBody.length > 0 ? endpoint.requestBody : ["name"];
    const schemaBlock = generateSchemaCode(tableName, fields);
    const migrationSQL = generateMigrationSQL([schemaBlock]);

    const base = endpointBasename(endpoint);
    const registerFnName = `register${toPascal(base)}Routes`;

    const generatedDir = path.join(projectRoot, "server", "generated");
    const routesDir = path.join(generatedDir, "routes");
    const storageDir = path.join(generatedDir, "storage");
    fs.mkdirSync(routesDir, { recursive: true });
    fs.mkdirSync(storageDir, { recursive: true });

    // ── Per-endpoint route file ────────────────────────────────────────────
    const routeFile = path.join(routesDir, `${base}.ts`);
    const routeContent = [
      "// AUTO-GENERATED by saas-dev:backend-wirer — do not edit manually",
      `import type { Request, Response, Express } from "express";`,
      `import { z } from "zod";`,
      "",
      routeBlock.zodSchemaCode ?? "",
      "",
      `export function ${registerFnName}(app: Express): void {`,
      routeBlock.code
        .split("\n")
        .map((l) => (l.length > 0 ? `  ${l}` : l))
        .join("\n"),
      `}`,
      "",
    ]
      .filter((s) => s !== undefined)
      .join("\n");
    fs.writeFileSync(routeFile, routeContent, "utf-8");

    // ── Per-entity storage file (idempotent per entity) ────────────────────
    const storageFile = path.join(storageDir, `${entityName}.ts`);
    const storageContent = [
      "// AUTO-GENERATED by saas-dev:backend-wirer — do not edit manually",
      `import { db } from "../../db";`,
      `import { ${tableName} } from "../../../shared/schema";`,
      "",
      `export const ${entityName}Storage = {`,
      storageBlock.code
        .split("\n")
        .map((l) => (l.length > 0 ? `  ${l}` : l))
        .join("\n"),
      `};`,
      "",
    ].join("\n");
    fs.writeFileSync(storageFile, storageContent, "utf-8");

    // ── server/generated/schema.ts (append idempotently) ───────────────────
    const generatedSchemaFile = path.join(generatedDir, "schema.ts");
    const schemaFileBanner =
      "// AUTO-GENERATED by saas-dev:backend-wirer — do not edit manually\n" +
      `import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\n` +
      `import { z } from "zod";\n\n`;
    const schemaBlockContent = [
      schemaBlock.drizzleCode,
      "",
      schemaBlock.zodInsertCode,
      "",
      schemaBlock.typeExportCode,
      "",
    ].join("\n");
    let existingGenSchema = fs.existsSync(generatedSchemaFile)
      ? fs.readFileSync(generatedSchemaFile, "utf-8")
      : schemaFileBanner;
    if (!existingGenSchema.startsWith("// AUTO-GENERATED")) {
      existingGenSchema = schemaFileBanner + existingGenSchema;
    }
    const tableDeclRegex = new RegExp(`export\\s+const\\s+${tableName}\\s*=\\s*pgTable`);
    if (!tableDeclRegex.test(existingGenSchema)) {
      existingGenSchema =
        (existingGenSchema.endsWith("\n") ? existingGenSchema : existingGenSchema + "\n") +
        "\n" +
        schemaBlockContent;
      fs.writeFileSync(generatedSchemaFile, existingGenSchema, "utf-8");
    }

    // ── shared/schema.ts marker append ─────────────────────────────────────
    const sharedSchemaBlock = [
      schemaBlock.drizzleCode,
      "",
      schemaBlock.zodInsertCode,
      "",
      schemaBlock.typeExportCode,
    ].join("\n");
    appendSchemaBlockIdempotent(projectRoot, sharedSchemaBlock, tableName);

    // ── server/generated/index.ts: add import + registration ───────────────
    const indexPath = ensureGeneratedIndex(generatedDir);
    addRouteToGeneratedIndex(indexPath, base, registerFnName);

    // ── Migration SQL (timestamped, out-of-tree from Drizzle journal) ──────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const migrationFile = path.join(migrationsDir, `${timestamp}-${base}.sql`);
    fs.writeFileSync(migrationFile, migrationSQL, "utf-8");

    return {
      endpointPath: endpoint.path,
      method: endpoint.method,
      tableName,
      generatedFiles: [
        routeFile,
        storageFile,
        generatedSchemaFile,
        indexPath,
        migrationFile,
      ],
      note: "Wired into server/generated/. registerGeneratedRoutes(app) is called from server/routes.ts via marker injection.",
    };
  },
};
