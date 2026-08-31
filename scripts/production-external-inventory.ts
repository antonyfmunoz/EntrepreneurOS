import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { connect as tlsConnect } from "node:tls";
import postgres from "postgres";
import {
  externalProductionInventoryGaps,
  type ExternalProductionInventorySignals,
} from "../server/security/external-production-inventory";

const repository = process.env.EOS_GITHUB_REPOSITORY || "antonyfmunoz/EntrepreneurOS";
const releaseBranch = process.env.EOS_PRODUCTION_RELEASE_BRANCH || "feature/company-system";
const environmentName = "entrepreneuros-production";
const flyApp = process.env.EOS_FLY_APP || "eos-app";
const publicOrigin = process.env.EOS_PUBLIC_ORIGIN || "https://entrepreneuros.net";
const outputPath = process.env.EOS_EXTERNAL_INVENTORY_PATH || ".tmp/eos-production-external-inventory.json";

function commandJson(command: string, args: string[], timeout = 30_000): any | null {
  try {
    const output = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout,
      windowsHide: true,
    });
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function commandText(command: string, args: string[], timeout = 30_000): string | null {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout,
    windowsHide: true,
  });
  const output = typeof result.stdout === "string" ? result.stdout : "";
  return output.trim() ? output : null;
}

function managedValue(reference: string): string | null {
  try {
    return execFileSync("op", ["read", reference], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
      windowsHide: true,
    }).trim() || null;
  } catch {
    return null;
  }
}

function itemFieldMap(item: any | null): Map<string, string> {
  return new Map(
    Array.isArray(item?.fields)
      ? item.fields.map((field: any) => [String(field.label || field.id || ""), String(field.value || "")])
      : [],
  );
}

function currentMigrationCount(): Promise<number> {
  const sources = [
    { directory: resolve("scripts", "migrations"), include: (_file: string) => true },
    { directory: resolve("migrations"), include: (file: string) => !file.startsWith("0000_") },
  ];
  return sources.reduce(async (totalPromise, source) => {
    const total = await totalPromise;
    const files = await readdir(source.directory).catch(() => [] as string[]);
    return total + files.filter((file) => file.endsWith(".sql") && source.include(file)).length;
  }, Promise.resolve(0));
}

async function httpObservation(path: string) {
  try {
    const response = await fetch(new URL(path, publicOrigin), {
      signal: AbortSignal.timeout(60_000),
      redirect: "manual",
      headers: { "user-agent": "EntrepreneurOS-External-Inventory/1.0" },
    });
    return {
      status: response.status,
      ok: response.ok,
      hsts: Boolean(response.headers.get("strict-transport-security")),
      csp: Boolean(response.headers.get("content-security-policy")),
      cacheControl: response.headers.get("cache-control") || null,
    };
  } catch {
    return { status: null, ok: false, hsts: false, csp: false, cacheControl: null };
  }
}

async function tlsObservation(hostname: string) {
  return new Promise<{ valid: boolean; issuer: string | null; validFrom: string | null; validTo: string | null; fingerprint256: string | null; protocol: string | null }>((resolveResult) => {
    const socket = tlsConnect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true }, () => {
      const certificate = socket.getPeerCertificate();
      resolveResult({
        valid: socket.authorized,
        issuer: certificate.issuer?.O || certificate.issuer?.CN || null,
        validFrom: certificate.valid_from || null,
        validTo: certificate.valid_to || null,
        fingerprint256: certificate.fingerprint256 || null,
        protocol: socket.getProtocol(),
      });
      socket.end();
    });
    socket.setTimeout(15_000, () => socket.destroy());
    socket.on("error", () => resolveResult({ valid: false, issuer: null, validFrom: null, validTo: null, fingerprint256: null, protocol: null }));
    socket.on("timeout", () => resolveResult({ valid: false, issuer: null, validFrom: null, validTo: null, fingerprint256: null, protocol: null }));
  });
}

async function googleObservation() {
  const clientId = managedValue("op://UMH-Production/Google-Workspace-OAuth/client_id");
  const clientSecret = managedValue("op://UMH-Production/Google-Workspace-OAuth/client_secret");
  const refreshToken = managedValue("op://UMH-Production/Google-Workspace-OAuth/refresh_token");
  if (!clientId || !clientSecret || !refreshToken) return { valid: false, scopes: [] as string[] };
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    const body = await response.json() as { access_token?: string; scope?: string };
    return {
      valid: response.ok && Boolean(body.access_token),
      scopes: String(body.scope || "").split(" ").filter(Boolean).sort(),
    };
  } catch {
    return { valid: false, scopes: [] as string[] };
  }
}

async function notionObservation() {
  const key = managedValue("op://UMH-Production/Notion-Integration/api_key");
  if (!key) return { valid: false, type: null, ownerType: null };
  try {
    const response = await fetch("https://api.notion.com/v1/users/me", {
      signal: AbortSignal.timeout(30_000),
      headers: { authorization: `Bearer ${key}`, "notion-version": "2022-06-28" },
    });
    const body = await response.json() as any;
    return { valid: response.ok && body.object === "user", type: body.type || null, ownerType: body.bot?.owner?.type || null };
  } catch {
    return { valid: false, type: null, ownerType: null };
  }
}

async function databaseObservation(targetMigrationCount: number) {
  const databaseUrl = managedValue("op://EntrepreneurOS/Production/DATABASE_URL")
    || managedValue("op://UMH-Production/Database-Neon/url");
  if (!databaseUrl) return { reachable: false, managed: false, databaseName: null, tableCount: null, migrationCount: null, latestMigration: null, companyCount: null, userCount: null, targetMigrationCount };
  let sql: ReturnType<typeof postgres> | null = null;
  try {
    const parsed = new URL(databaseUrl);
    sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
    const identity = await sql<{ database_name: string; migrations_table: string | null; companies_table: string | null; users_table: string | null }[]>`
      SELECT current_database() AS database_name,
        to_regclass('public.eos_schema_migrations')::text AS migrations_table,
        to_regclass('public.companies')::text AS companies_table,
        to_regclass('public.users')::text AS users_table
    `;
    const tables = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = current_schema()`;
    const migrations = identity[0]?.migrations_table ? await sql<{ count: number; latest: string | null }[]>`SELECT count(*)::int AS count, max(id) AS latest FROM eos_schema_migrations` : [];
    const companies = identity[0]?.companies_table ? await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM companies` : [];
    const users = identity[0]?.users_table ? await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM users` : [];
    return {
      reachable: true,
      managed: !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname),
      databaseName: identity[0]?.database_name || null,
      tableCount: tables[0]?.count ?? null,
      migrationCount: migrations[0]?.count ?? null,
      latestMigration: migrations[0]?.latest ?? null,
      companyCount: companies[0]?.count ?? null,
      userCount: users[0]?.count ?? null,
      targetMigrationCount,
    };
  } catch {
    return { reachable: false, managed: false, databaseName: null, tableCount: null, migrationCount: null, latestMigration: null, companyCount: null, userCount: null, targetMigrationCount };
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

function runtimeDatabaseObservation(targetMigrationCount: number) {
  const program = "import('postgres').then(async({default:p})=>{let s;try{s=p(process.env.DATABASE_URL,{max:1,connect_timeout:15});const i=await s.unsafe('select current_database() as database_name');const t=await s.unsafe('select count(*)::int as count from information_schema.tables where table_schema=current_schema()');const m=await s.unsafe('select count(*)::int as count,max(id) as latest from eos_schema_migrations');const c=await s.unsafe('select count(*)::int as count from companies');const u=await s.unsafe('select count(*)::int as count from users');console.log('EOS_INVENTORY:'+JSON.stringify({reachable:true,databaseName:i[0].database_name,tableCount:t[0].count,migrationCount:m[0].count,latestMigration:m[0].latest,companyCount:c[0].count,userCount:u[0].count}))}catch(e){console.log('EOS_INVENTORY:'+JSON.stringify({reachable:false,code:e?.code||null}))}finally{if(s)await s.end({timeout:5}).catch(()=>{})}})";
  const remoteCommand = `node -e "${program.replaceAll('"', '\\"')}"`;
  const output = commandText("flyctl", ["ssh", "console", "--app", flyApp, "-C", remoteCommand], 60_000);
  const line = output?.split(/\r?\n/).find((entry) => entry.startsWith("EOS_INVENTORY:"));
  if (!line) return { reachable: false, databaseName: null, tableCount: null, migrationCount: null, latestMigration: null, companyCount: null, userCount: null, targetMigrationCount };
  try {
    return { ...JSON.parse(line.slice("EOS_INVENTORY:".length)), targetMigrationCount };
  } catch {
    return { reachable: false, databaseName: null, tableCount: null, migrationCount: null, latestMigration: null, companyCount: null, userCount: null, targetMigrationCount };
  }
}

const [targetMigrationCount, home, health, ready, tls, ipv4, ipv6, nameservers, google, notion] = await Promise.all([
  currentMigrationCount(),
  httpObservation("/"),
  httpObservation("/health"),
  httpObservation("/api/ready"),
  tlsObservation(new URL(publicOrigin).hostname),
  dns.resolve4(new URL(publicOrigin).hostname).catch(() => []),
  dns.resolve6(new URL(publicOrigin).hostname).catch(() => []),
  dns.resolveNs(new URL(publicOrigin).hostname).catch(() => []),
  googleObservation(),
  notionObservation(),
]);
const [vaultDatabaseCandidate, runtimeDatabase] = await Promise.all([
  databaseObservation(targetMigrationCount),
  Promise.resolve(runtimeDatabaseObservation(targetMigrationCount)),
]);
const vaultCandidateMatchesRuntime = Boolean(
  vaultDatabaseCandidate.reachable
  && runtimeDatabase.reachable
  && vaultDatabaseCandidate.databaseName === runtimeDatabase.databaseName,
);

const repo = commandJson("gh", ["repo", "view", repository, "--json", "defaultBranchRef,url"]);
const branchProtection = commandJson("gh", ["api", `repos/${repository}/branches/${encodeURIComponent(releaseBranch)}/protection`]);
const codeAlerts = commandJson("gh", ["api", `repos/${repository}/code-scanning/alerts?state=open&per_page=100`]);
const dependencyAlerts = commandJson("gh", ["api", `repos/${repository}/dependabot/alerts?state=open&per_page=100`]);
const githubEnvironment = commandJson("gh", ["api", `repos/${repository}/environments/${environmentName}`]);
const machines = commandJson("flyctl", ["machines", "list", "--app", flyApp, "--json"], 60_000) || [];
const releases = commandJson("flyctl", ["releases", "--app", flyApp, "--json"], 60_000) || [];
const flySecrets = commandJson("flyctl", ["secrets", "list", "--app", flyApp, "--json"], 60_000) || [];
const vaultItems = commandJson("op", ["item", "list", "--vault", "EntrepreneurOS", "--format", "json"]) || [];
const productionItemExists = vaultItems.some((item: any) => item.title === "Production");
const productionItem = productionItemExists ? commandJson("op", ["item", "get", "Production", "--vault", "EntrepreneurOS", "--format", "json"]) : null;
const productionFields = itemFieldMap(productionItem);
const sourceClerk = itemFieldMap(commandJson("op", ["item", "get", "EOS-Clerk", "--vault", "UMH-Production", "--format", "json"]));
const sourcePosthog = itemFieldMap(commandJson("op", ["item", "get", "EOS-PostHog", "--vault", "UMH-Production", "--format", "json"]));
const sourceAnthropic = itemFieldMap(commandJson("op", ["item", "get", "AI-Anthropic", "--vault", "UMH-Production", "--format", "json"]));
const envTemplate = await readFile(".env.production.op.tpl", "utf8");
const requiredProductionFields = Array.from(envTemplate.matchAll(/^([A-Z0-9_]+)=op:\/\/EntrepreneurOS\/Production\/([^\r\n]+)$/gm)).map((match) => ({ variable: match[1], field: match[2] }));
const missingRequiredFields = requiredProductionFields.filter(({ field }) => !productionFields.get(field)?.trim()).map(({ variable }) => variable).sort();
const machineDigests = Array.from(new Set(machines.map((machine: any) => machine.image_ref?.digest).filter(Boolean)));
const releaseSubjects = Array.from(new Set(machines.map((machine: any) => machine.config?.env?.EOS_RELEASE_SUBJECT).filter(Boolean)));
const flySecretNames = flySecrets.filter((secret: any) => secret.status === "Deployed").map((secret: any) => secret.name).sort();
const requiredFlySecretNames = [
  "CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL", "SESSION_SECRET", "EOS_CREDENTIAL_ENCRYPTION_KEY",
  "EOS_ALERT_WEBHOOK_URL", "EOS_ALERT_WEBHOOK_SECRET", "STRIPE_RESTRICTED_KEY", "STRIPE_WEBHOOK_SECRET", "EOS_STRIPE_PLANS",
  "EOS_ARTIFACT_S3_BUCKET", "EOS_ARTIFACT_S3_ENDPOINT", "EOS_ARTIFACT_S3_SSE_CUSTOMER_KEY", "EOS_ARTIFACT_S3_ACCESS_KEY_ID", "EOS_ARTIFACT_S3_SECRET_ACCESS_KEY",
  "EOS_ARTIFACT_BACKUP_S3_BUCKET", "EOS_ARTIFACT_BACKUP_S3_ENDPOINT", "EOS_ARTIFACT_BACKUP_S3_SSE_CUSTOMER_KEY", "EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID", "EOS_ARTIFACT_BACKUP_S3_SECRET_ACCESS_KEY",
  "EOS_MALWARE_SCAN_ENDPOINT", "EOS_MALWARE_SCAN_SECRET", "NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET",
];
const missingFlySecretNames = requiredFlySecretNames.filter((name) => !flySecretNames.includes(name));
const googleScopes = new Set(google.scopes);
const environmentRules = Array.isArray(githubEnvironment?.protection_rules) ? githubEnvironment.protection_rules : [];
const services = machines.flatMap((machine: any) => machine.config?.services || []);

const signals: ExternalProductionInventorySignals = {
  github: {
    defaultBranchCanonical: repo?.defaultBranchRef?.name === releaseBranch,
    protectedChecksConfigured: branchProtection?.required_status_checks?.strict === true && ["qualify", "Analyze (javascript-typescript)"].every((context) => branchProtection?.required_status_checks?.contexts?.includes(context)),
    productionEnvironmentConfigured: githubEnvironment?.name === environmentName && githubEnvironment?.deployment_branch_policy?.protected_branches === true,
    productionEnvironmentApprovalRequired: environmentRules.some((rule: any) => rule.type === "required_reviewers" && rule.reviewers?.length > 0),
    openCodeScanningAlerts: Array.isArray(codeAlerts) ? codeAlerts.length : null,
    openDependabotAlerts: Array.isArray(dependencyAlerts) ? dependencyAlerts.length : null,
  },
  fly: {
    oneImmutableImage: machineDigests.length === 1 && /^sha256:[a-f0-9]{64}$/.test(String(machineDigests[0] || "")),
    releaseSubjectPresent: releaseSubjects.length === 1 && /^(?:git:[a-f0-9]{40}|image:sha256:[a-f0-9]{64})$/.test(String(releaseSubjects[0] || "")),
    minimumMachineAvailable: services.some((service: any) => Number(service.min_machines_running) >= 1 && service.autostop !== "suspend"),
    productionSecretSetComplete: missingFlySecretNames.length === 0,
  },
  publicRuntime: { healthOk: health.ok, readinessOk: ready.ok, hstsPresent: home.hsts, cspPresent: home.csp, tlsValid: tls.valid },
  vault: {
    productionItemExists,
    missingRequiredFields,
    clerkLive: productionFields.get("CLERK_PUBLISHABLE_KEY")?.startsWith("pk_live_") === true && productionFields.get("CLERK_SECRET_KEY")?.startsWith("sk_live_") === true,
    stripeLive: productionFields.get("STRIPE_RESTRICTED_KEY")?.startsWith("rk_live_") === true && productionFields.get("STRIPE_WEBHOOK_SECRET")?.startsWith("whsec_") === true,
    primaryArtifactPlanePresent: ["EOS_ARTIFACT_S3_BUCKET", "EOS_ARTIFACT_S3_ENDPOINT", "EOS_ARTIFACT_S3_SSE_CUSTOMER_KEY", "EOS_ARTIFACT_S3_ACCESS_KEY_ID", "EOS_ARTIFACT_S3_SECRET_ACCESS_KEY"].every((name) => Boolean(productionFields.get(name)?.trim())),
    backupArtifactPlanePresent: ["EOS_ARTIFACT_BACKUP_S3_BUCKET", "EOS_ARTIFACT_BACKUP_S3_ENDPOINT", "EOS_ARTIFACT_BACKUP_S3_SSE_CUSTOMER_KEY", "EOS_ARTIFACT_BACKUP_S3_ACCESS_KEY_ID", "EOS_ARTIFACT_BACKUP_S3_SECRET_ACCESS_KEY"].every((name) => Boolean(productionFields.get(name)?.trim())) && productionFields.get("EOS_ARTIFACT_BACKUP_S3_BUCKET") !== productionFields.get("EOS_ARTIFACT_S3_BUCKET"),
    malwareScannerPresent: Boolean(productionFields.get("EOS_MALWARE_SCAN_ENDPOINT")?.startsWith("https://") && productionFields.get("EOS_MALWARE_SCAN_SECRET")),
    alertReceiverPresent: Boolean(productionFields.get("EOS_ALERT_WEBHOOK_URL")?.startsWith("https://") && productionFields.get("EOS_ALERT_WEBHOOK_SECRET")),
  },
  providers: {
    googleCredentialValid: google.valid,
    gmailRead: googleScopes.has("https://www.googleapis.com/auth/gmail.readonly"),
    gmailSend: googleScopes.has("https://www.googleapis.com/auth/gmail.send"),
    driveRead: googleScopes.has("https://www.googleapis.com/auth/drive.readonly"),
    calendarEvents: googleScopes.has("https://www.googleapis.com/auth/calendar.events"),
    notionInternalBotValid: notion.valid && notion.type === "bot" && notion.ownerType === "workspace",
    notionPublicOAuthPresent: Boolean(productionFields.get("NOTION_CLIENT_ID") && productionFields.get("NOTION_CLIENT_SECRET")),
    posthogProjectKeyPresent: sourcePosthog.get("POSTHOG_KEY")?.startsWith("phc_") === true,
    anthropicCredentialPresent: Boolean(sourceAnthropic.get("api_key")),
  },
  database: {
    reachable: runtimeDatabase.reachable === true,
    migrationCount: runtimeDatabase.migrationCount ?? null,
    targetMigrationCount,
    vaultCandidateMatchesRuntime,
  },
};

const evidence = {
  standard: "eos.production-external-inventory.v1",
  generatedAt: new Date().toISOString(),
  scope: "read_only_external_observation",
  productionEvidence: "partial_observation_only",
  releaseCandidate: { commit: commandJson("gh", ["api", `repos/${repository}/commits/${encodeURIComponent(releaseBranch)}`])?.sha || null, branch: releaseBranch },
  github: { ...signals.github, environmentName, environmentRuleTypes: environmentRules.map((rule: any) => rule.type).sort() },
  fly: {
    ...signals.fly,
    app: flyApp,
    machineCount: machines.length,
    machineStates: machines.map((machine: any) => machine.state).sort(),
    machineDigests,
    releaseSubjects,
    latestReleaseVersion: releases[0]?.Version ?? releases[0]?.version ?? null,
    deployedSecretNames: flySecretNames,
    missingRequiredSecretNames: missingFlySecretNames,
  },
  publicRuntime: { ...signals.publicRuntime, origin: publicOrigin, home, health, ready, tls, dns: { ipv4: ipv4.sort(), ipv6: ipv6.sort(), nameservers: nameservers.sort() } },
  vault: { ...signals.vault, itemTitles: vaultItems.map((item: any) => item.title).sort(), requiredFieldCount: requiredProductionFields.length, sourceCredentialClasses: { clerkPublishable: sourceClerk.get("publishable_key")?.startsWith("pk_live_") ? "live" : sourceClerk.get("publishable_key")?.startsWith("pk_test_") ? "test" : "missing", clerkSecret: sourceClerk.get("secret_key")?.startsWith("sk_live_") ? "live" : sourceClerk.get("secret_key")?.startsWith("sk_test_") ? "test" : "missing" } },
  providers: { ...signals.providers, googleScopes: google.scopes, notionInternalType: notion.type, notionInternalOwnerType: notion.ownerType },
  database: { runtime: runtimeDatabase, vaultCandidate: vaultDatabaseCandidate, vaultCandidateMatchesRuntime },
  gaps: externalProductionInventoryGaps(signals),
  outsideScopeRequiringSeparateEvidence: ["legal_professional_approval", "support_staffing_and_sla", "vendor_risk_dispositions", "production_drills", "empyrean_client_zero", "operator_handoff", "second_company", "native_cutovers", "optional_umh_field_round_trip", "institutional_scale"],
};

const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
const sha256 = createHash("sha256").update(serialized).digest("hex");
await writeFile(`${outputPath}.sha256`, `${sha256}  ${outputPath}\n`, { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ inventoryCreated: true, outputPath, sha256, gapCount: evidence.gaps.length, gaps: evidence.gaps }));
if (evidence.gaps.length) process.exitCode = 2;
