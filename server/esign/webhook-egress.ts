import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";

function blockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("ff");
}

export function parseNativeEsignWebhookEndpoint(value: string): URL {
  const endpoint = new URL(value);
  const test = process.env.NODE_ENV === "test";
  if (endpoint.username || endpoint.password || endpoint.hash)
    throw new Error("Webhook endpoints cannot contain credentials or fragments.");
  if (test ? !["http:", "https:"].includes(endpoint.protocol) : endpoint.protocol !== "https:")
    throw new Error("Webhook endpoints must use HTTPS.");
  if (!test && endpoint.port && endpoint.port !== "443")
    throw new Error("Webhook endpoints must use the standard HTTPS port.");
  if (!test && ["localhost", "localhost.localdomain"].includes(endpoint.hostname.toLowerCase()))
    throw new Error("Webhook endpoints cannot target a loopback host.");
  return endpoint;
}

async function safeAddresses(endpoint: URL) {
  const literalFamily = isIP(endpoint.hostname);
  const addresses = literalFamily
    ? [{ address: endpoint.hostname, family: literalFamily }]
    : await lookup(endpoint.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("Webhook hostname did not resolve.");
  if (addresses.some(({ address, family }) => family === 4 ? blockedIpv4(address) : blockedIpv6(address)))
    throw new Error("Webhook endpoint resolved to a private or reserved network.");
  return addresses;
}

export async function assertNativeEsignWebhookEgressSafe(endpoint: URL): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await safeAddresses(endpoint);
}

export async function postNativeEsignWebhook(endpoint: URL, headers: Record<string, string>, body: string): Promise<number> {
  if (process.env.NODE_ENV === "test") {
    const response = await fetch(endpoint, { method: "POST", headers, body, redirect: "error", signal: AbortSignal.timeout(10_000) });
    return response.status;
  }
  const [target] = await safeAddresses(endpoint);
  return new Promise<number>((resolve, reject) => {
    const request = httpsRequest(endpoint, {
      method: "POST",
      headers,
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family as 4 | 6),
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode || 0));
    });
    request.setTimeout(10_000, () => request.destroy(new Error("Webhook delivery timeout.")));
    request.on("error", reject);
    request.end(body);
  });
}
