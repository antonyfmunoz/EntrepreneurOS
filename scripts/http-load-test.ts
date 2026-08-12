import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type LoadResult = {
  standard: "eos.http-load.v1";
  generatedAt: string;
  target: { origin: string; path: string };
  requests: number;
  concurrency: number;
  successRate: number;
  statusCounts: Record<string, number>;
  latencyMs: { min: number; p50: number; p95: number; p99: number; max: number; average: number };
  thresholds: { minimumSuccessRate: number; maximumP95Ms: number };
  passed: boolean;
};

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Expected an integer between ${minimum} and ${maximum}.`);
  return parsed;
}

function percentile(sorted: number[], fraction: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function validateTarget(target: URL): void {
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(target.hostname);
  if (loopback) return;
  if (target.protocol !== "https:") throw new Error("Non-loopback load targets must use HTTPS.");
  if (process.env.EOS_LOAD_TEST_APPROVED !== "true") throw new Error("External load tests require EOS_LOAD_TEST_APPROVED=true.");
  if (!process.env.EOS_LOAD_TEST_ALLOWED_HOST || target.hostname !== process.env.EOS_LOAD_TEST_ALLOWED_HOST) throw new Error("External load target is not the explicitly allowed host.");
  if (!["/api/health", "/api/ready", "/.well-known/umh/capability-manifest"].includes(target.pathname)) throw new Error("External load tests are restricted to safe read-only probe routes.");
}

export async function runHttpLoadTest(): Promise<LoadResult> {
  const rawTarget = process.env.EOS_LOAD_TEST_TARGET;
  if (!rawTarget) throw new Error("EOS_LOAD_TEST_TARGET is required.");
  const target = new URL(rawTarget);
  validateTarget(target);
  const requests = boundedInteger(process.env.EOS_LOAD_TEST_REQUESTS, 300, 10, 10_000);
  const concurrency = boundedInteger(process.env.EOS_LOAD_TEST_CONCURRENCY, 20, 1, 100);
  const timeoutMs = boundedInteger(process.env.EOS_LOAD_TEST_TIMEOUT_MS, 5_000, 100, 60_000);
  const minimumSuccessRate = Number(process.env.EOS_LOAD_TEST_MINIMUM_SUCCESS_RATE ?? 0.995);
  const maximumP95Ms = Number(process.env.EOS_LOAD_TEST_MAXIMUM_P95_MS ?? 2_000);
  if (!(minimumSuccessRate > 0 && minimumSuccessRate <= 1)) throw new Error("Minimum success rate must be within (0, 1].");
  if (!(maximumP95Ms > 0 && Number.isFinite(maximumP95Ms))) throw new Error("Maximum p95 latency must be positive.");

  let nextRequest = 0;
  const latencies: number[] = [];
  const statusCounts: Record<string, number> = {};
  async function worker(): Promise<void> {
    while (true) {
      const requestIndex = nextRequest++;
      if (requestIndex >= requests) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = performance.now();
      try {
        const response = await fetch(target, { method: "GET", redirect: "manual", signal: controller.signal, headers: { "user-agent": "EntrepreneurOS-Qualification/1.0" } });
        const status = String(response.status);
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        await response.arrayBuffer();
      } catch (error) {
        const status = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      } finally {
        clearTimeout(timeout);
        latencies.push(performance.now() - startedAt);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  const sorted = latencies.sort((a, b) => a - b);
  const successful = Object.entries(statusCounts).reduce((total, [status, count]) => total + (/^2\d\d$/.test(status) ? count : 0), 0);
  const successRate = successful / requests;
  const p95 = percentile(sorted, 0.95);
  const result: LoadResult = {
    standard: "eos.http-load.v1",
    generatedAt: new Date().toISOString(),
    target: { origin: target.origin, path: target.pathname },
    requests,
    concurrency,
    successRate,
    statusCounts,
    latencyMs: {
      min: Number((sorted[0] || 0).toFixed(2)),
      p50: Number(percentile(sorted, 0.5).toFixed(2)),
      p95: Number(p95.toFixed(2)),
      p99: Number(percentile(sorted, 0.99).toFixed(2)),
      max: Number((sorted.at(-1) || 0).toFixed(2)),
      average: Number((sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(2)),
    },
    thresholds: { minimumSuccessRate, maximumP95Ms },
    passed: successRate >= minimumSuccessRate && p95 <= maximumP95Ms,
  };
  if (process.env.EOS_LOAD_TEST_RESULT_PATH) {
    await mkdir(dirname(process.env.EOS_LOAD_TEST_RESULT_PATH), { recursive: true });
    await writeFile(process.env.EOS_LOAD_TEST_RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  return result;
}

runHttpLoadTest()
  .then((result) => { console.log(JSON.stringify(result)); if (!result.passed) process.exitCode = 1; })
  .catch((error) => { console.error(JSON.stringify({ standard: "eos.http-load.v1", passed: false, error: error instanceof Error ? error.message : "Load test failed." })); process.exitCode = 1; });
