/**
 * Stitch screen management (Plan 03-09).
 *
 * `list_screens` is a real Stitch MCP tool (confirmed in
 * @google/stitch-sdk@0.0.3 tool-definitions.js) and is wired to the shared
 * `defaultStitchMcpInvoke`. `delete_screen` is NOT exposed by the Stitch MCP
 * — `deleteScreen` here remains a best-effort stub so the rest of the pipeline
 * (Step 3 reject path in ui-generator SKILL.md) can call it without special-
 * casing. When/if Google ships a real delete tool, flip the implementation in
 * one place and the rest of the pipeline picks it up. See
 * .planning/stitch-mcp-research.md.
 */

import { defaultStitchMcpInvoke } from "./mcp-invoker.js";
import { STITCH_MCP_TOOLS, type McpInvokeFn } from "./types.js";

export interface ScreenDeleteResult {
  deleted: boolean;
  error?: string;
}

export interface ScreenRecord {
  id: string;
  name: string;     // full resource name `projects/{p}/screens/{s}`
  createdAt: string;
}

/**
 * Extract a Stitch screen id from a screenshot URL or resource name.
 *
 * Stitch returns screens with a `name` of the form
 * `projects/{projectId}/screens/{screenId}`. Screenshot URLs (presigned)
 * historically encode the same `screens/{screenId}` segment. Both formats
 * are supported here.
 */
export function extractScreenIdFromUrl(input: string): string | null {
  if (!input) return null;
  const match = input.match(/\/screens\/([^\/?#]+)/);
  return match?.[1] ?? null;
}

/**
 * Delete a screen from a Stitch project.
 *
 * NOT WIRED — Stitch MCP does not expose a delete tool as of SDK 0.0.3. This
 * function is intentionally a no-op success-path-disabled stub so the
 * ui-generator skill's "screen cleanup before retry" block can call it without
 * conditional logic. To enable in the future, change `mcpInvoke` to default
 * to `defaultStitchMcpInvoke` and use the real tool name once Google ships it.
 *
 * @returns `{ deleted: false }` with an explanatory error string. Never throws.
 */
export async function deleteScreen(
  projectId: string,
  screenId: string,
  mcpInvoke?: McpInvokeFn
): Promise<ScreenDeleteResult> {
  if (!projectId || !screenId) {
    return { deleted: false, error: "missing projectId or screenId" };
  }
  if (!mcpInvoke) {
    return {
      deleted: false,
      error: "Stitch MCP does not expose a delete_screen tool (SDK 0.0.3)",
    };
  }
  try {
    // Tests inject `mcpInvoke`. Production has no real tool to call.
    await mcpInvoke("delete_screen", { projectId, screenId });
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: (err as Error).message };
  }
}

/**
 * Raw response shape from `list_screens`. The Stitch MCP returns an object
 * with a `screens` array; each screen has `name`, `displayName`, `createTime`.
 * We normalise to a stable internal shape.
 */
interface RawListScreensResponse {
  screens?: Array<{
    name?: string;          // "projects/{p}/screens/{s}"
    displayName?: string;
    createTime?: string;
    [k: string]: unknown;
  }>;
}

/**
 * List all screens in a Stitch project. Wired to the real `list_screens` tool.
 *
 * Best-effort: returns `[]` on any failure (env missing, network error, MCP
 * error). Never throws — callers can ignore failures and continue.
 *
 * @param mcpInvoke  Test injection point. Defaults to the shared production
 *                   invoker that talks to stitch.googleapis.com via the SDK.
 */
export async function listScreens(
  projectId: string,
  mcpInvoke: McpInvokeFn = defaultStitchMcpInvoke
): Promise<ScreenRecord[]> {
  if (!projectId) return [];
  try {
    const result = (await mcpInvoke(STITCH_MCP_TOOLS.LIST_SCREENS, {
      projectId,
    })) as RawListScreensResponse | ScreenRecord[];

    // Accept both the documented `{ screens: [...] }` envelope and a bare
    // array — keeps tests simple and tolerates SDK shape drift.
    const rawScreens = Array.isArray(result) ? result : result?.screens ?? [];

    return rawScreens
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => {
        const name = String((r as { name?: unknown }).name ?? "");
        const id =
          extractScreenIdFromUrl(name) ??
          String((r as { id?: unknown }).id ?? "");
        return {
          id,
          name,
          createdAt: String(
            (r as { createTime?: unknown; createdAt?: unknown }).createTime ??
              (r as { createdAt?: unknown }).createdAt ??
              ""
          ),
        };
      });
  } catch (err) {
    console.warn("[screen-management] listScreens failed:", (err as Error).message);
    return [];
  }
}
