/**
 * Stitch screen management (Plan 03-09).
 *
 * When a generated screen is rejected at the approval gate, we want to delete
 * it from the Stitch project so the rejected screen does not pollute future
 * iterations. Stitch's MCP does not currently expose a delete_screen tool, so
 * these helpers are best-effort: they accept an injectable mcpInvoke for tests
 * and never throw on failure.
 */

export interface ScreenDeleteResult {
  deleted: boolean;
  error?: string;
}

export interface ScreenRecord {
  id: string;
  name: string;
  createdAt: string;
}

type McpInvoke = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Extract a Stitch screen id from a screenshot URL.
 * Stitch URLs look like: https://stitch.withgoogle.com/.../screens/{screenId}/...
 * Returns null when the URL is unrecognised.
 */
export function extractScreenIdFromUrl(screenshotUrl: string): string | null {
  if (!screenshotUrl) return null;
  const match = screenshotUrl.match(/\/screens\/([^\/?#]+)/);
  return match?.[1] ?? null;
}

/**
 * Delete a screen from a Stitch project.
 * Best-effort: returns { deleted: false, error } on any failure rather than throwing.
 */
export async function deleteScreen(
  projectId: string,
  screenId: string,
  mcpInvoke?: McpInvoke
): Promise<ScreenDeleteResult> {
  if (!projectId || !screenId) {
    return { deleted: false, error: "missing projectId or screenId" };
  }
  if (!mcpInvoke) {
    return { deleted: false, error: "Stitch delete API not yet implemented (no MCP invoker provided)" };
  }
  try {
    await mcpInvoke("stitch_delete_screen", { projectId, screenId });
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: (err as Error).message };
  }
}

/**
 * List all screens in a Stitch project. Best-effort.
 */
export async function listScreens(
  projectId: string,
  mcpInvoke?: McpInvoke
): Promise<ScreenRecord[]> {
  if (!projectId || !mcpInvoke) return [];
  try {
    const result = await mcpInvoke("stitch_list_screens", { projectId });
    if (Array.isArray(result)) {
      return result
        .filter((r): r is ScreenRecord => !!r && typeof r === "object" && "id" in r)
        .map((r) => ({
          id: String((r as ScreenRecord).id),
          name: String((r as ScreenRecord).name ?? ""),
          createdAt: String((r as ScreenRecord).createdAt ?? ""),
        }));
    }
    return [];
  } catch (err) {
    console.warn("[screen-management] listScreens failed:", (err as Error).message);
    return [];
  }
}
