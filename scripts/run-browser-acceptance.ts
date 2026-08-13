import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const node = process.execPath;
const tsxCli = resolve("node_modules", "tsx", "dist", "cli.mjs");
const viteCli = resolve("node_modules", "vite", "bin", "vite.js");
const environment = {
  ...process.env,
  NODE_ENV: "test",
  EOS_E2E_FIXTURE: "true",
  EOS_E2E_API_ORIGIN: "http://127.0.0.1:5111",
  EOS_E2E_CLIENT_ORIGIN: "http://127.0.0.1:5110",
};

const processes = [
  spawn(node, [tsxCli, "scripts/e2e-fixture-server.ts"], { env: environment, stdio: ["ignore", "pipe", "pipe"] }),
  spawn(node, [viteCli, "--config", "vite.e2e.config.ts"], { env: environment, stdio: ["ignore", "pipe", "pipe"] }),
];
const logs: string[] = [];
for (const child of processes) {
  child.stdout?.on("data", (data) => logs.push(String(data)));
  child.stderr?.on("data", (data) => logs.push(String(data)));
}

async function waitFor(url: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for ${url}.\n${logs.join("").slice(-4000)}`);
}

function runAcceptance(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [tsxCli, "tests/e2e/mvp-browser-acceptance.ts"], { env: environment, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Browser acceptance exited with ${code}.`)));
    child.on("error", reject);
  });
}

function runLoadAcceptance(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(node, [tsxCli, "scripts/http-load-test.ts"], {
      env: {
        ...environment,
        EOS_LOAD_TEST_TARGET: "http://127.0.0.1:5111/api/portfolios",
        EOS_LOAD_TEST_REQUESTS: "300",
        EOS_LOAD_TEST_CONCURRENCY: "20",
        EOS_LOAD_TEST_MAXIMUM_P95_MS: "2000",
        EOS_LOAD_TEST_RESULT_PATH: ".tmp/eos-local-load-result.json",
      },
      stdio: "inherit",
    });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Load acceptance exited with ${code}.`)));
    child.on("error", reject);
  });
}

try {
  await Promise.all([waitFor("http://127.0.0.1:5111/.well-known/umh/capability-manifest"), waitFor("http://127.0.0.1:5110")]);
  await runAcceptance();
  const resetResponse = await fetch("http://127.0.0.1:5111/__fixture/reset-rate-limits", { method: "POST" });
  if (!resetResponse.ok) throw new Error(`Browser fixture rate-limit reset failed with ${resetResponse.status}.`);
  await runLoadAcceptance();
} finally {
  for (const child of processes) {
    if (!child.pid) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
}
