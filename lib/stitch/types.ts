/**
 * Stitch SDK wrapper types.
 * Stitch returns presigned URLs, not raw HTML/image content (Pitfall #4).
 */

export interface StitchGenerateRequest {
  prompt: string;
  deviceType?: "DESKTOP" | "MOBILE" | "TABLET" | "AGNOSTIC";
}

export interface StitchGenerateResult {
  htmlUrl: string;       // presigned URL from screen.getHtml() — fetch this URL to get actual HTML
  screenshotUrl: string; // presigned URL from screen.getImage() — fetch this URL to get actual image
  projectId: string;
  screenId: string;
}

export class StitchWrapperError extends Error {
  constructor(
    message: string,
    public readonly recoverable: boolean,
    public readonly code: string
  ) {
    super(message);
    this.name = "StitchWrapperError";
  }
}

/**
 * Function signature for invoking a Stitch MCP tool. Used for dependency
 * injection in tests, and as the contract the shared `mcp-invoker.ts` factory
 * implements in production.
 */
export type McpInvokeFn = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<unknown>;

/**
 * The complete Stitch MCP tool surface as of @google/stitch-sdk@0.0.3.
 *
 * Read directly from node_modules/@google/stitch-sdk/dist/generated/src/tool-definitions.js.
 * If you add a name here that isn't in that file, calls will 404.
 *
 * NOT EXPOSED by the SDK (do not add): delete_screen, delete_project,
 * export_design_system, import_design_system, generate_design_system.
 * See .planning/stitch-mcp-research.md for the rationale and a watcher script
 * that diffs this against the installed SDK.
 */
export const STITCH_MCP_TOOLS = {
  CREATE_PROJECT: "create_project",
  GET_PROJECT: "get_project",
  LIST_PROJECTS: "list_projects",
  LIST_SCREENS: "list_screens",
  GET_SCREEN: "get_screen",
  GENERATE_SCREEN_FROM_TEXT: "generate_screen_from_text",
  EDIT_SCREENS: "edit_screens",
  GENERATE_VARIANTS: "generate_variants",
} as const;

export type StitchMcpTool = (typeof STITCH_MCP_TOOLS)[keyof typeof STITCH_MCP_TOOLS];
