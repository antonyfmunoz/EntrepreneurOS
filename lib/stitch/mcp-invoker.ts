import { StitchToolClient } from "@google/stitch-sdk";
import type { McpInvokeFn } from "./types.js";
import { StitchWrapperError } from "./types.js";
import { getStitchApiKey } from "../env.js";

/**
 * Single source of truth for constructing the Stitch MCP client.
 *
 * Stitch is consumed in-process via @google/stitch-sdk, which itself wraps the
 * official hosted MCP server at https://stitch.googleapis.com/mcp using
 * @modelcontextprotocol/sdk under the hood. There is NO stdio MCP server to
 * configure in .mcp.json — the SDK is the MCP transport.
 *
 * This module exists so client.ts, screen-management.ts, and any future helper
 * share one client instance and one env-var dance instead of duplicating it.
 */

let sharedClient: StitchToolClient | null = null;

/**
 * Returns a shared StitchToolClient, lazily constructed on first call.
 * Throws StitchWrapperError("ENV_MISSING") if STITCH_API_KEY is unset.
 */
export function getStitchToolClient(): StitchToolClient {
  if (sharedClient) return sharedClient;
  let apiKey: string;
  try {
    apiKey = getStitchApiKey();
  } catch {
    throw new StitchWrapperError(
      "STITCH_API_KEY environment variable is not set. Get your key from stitch.withgoogle.com account settings.",
      false,
      "ENV_MISSING"
    );
  }
  sharedClient = new StitchToolClient({ apiKey });
  return sharedClient;
}

/**
 * Test-only: reset the cached client. Lets unit tests inject fresh state.
 */
export function __resetStitchToolClientForTests(): void {
  sharedClient = null;
}

/**
 * Default `McpInvokeFn` implementation. Delegates to the shared
 * StitchToolClient. Errors propagate to the caller — wrapping is the caller's
 * job (e.g. fail-open in screen-management, retry in client.ts).
 */
export const defaultStitchMcpInvoke: McpInvokeFn = async (toolName, args) => {
  const client = getStitchToolClient();
  return client.callTool(toolName, args as Record<string, unknown>);
};
