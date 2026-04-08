import { StitchError } from "@google/stitch-sdk";
import pRetry, { AbortError } from "p-retry";
import type { StitchGenerateRequest, StitchGenerateResult } from "./types.js";
import { STITCH_MCP_TOOLS, StitchWrapperError } from "./types.js";
import { getStitchToolClient } from "./mcp-invoker.js";

/**
 * Generate a UI screen via the Stitch API with automatic retry on transient errors.
 *
 * Bypasses SDK's Project.generate() due to a bug in outputComponents indexing
 * (SDK 0.0.3). Calls the MCP tool directly and finds the design component
 * by scanning all outputComponents for the one with a `design.screens` array.
 *
 * @param projectId - Stitch project ID to generate within
 * @param request - Prompt and optional device type
 * @returns Presigned URLs for HTML and screenshot (NOT raw content — fetch URLs to download)
 * @throws StitchWrapperError for non-recoverable errors (auth, validation, permission)
 */
export async function generateScreen(
  projectId: string,
  request: StitchGenerateRequest
): Promise<StitchGenerateResult> {
  return pRetry(
    async () => {
      try {
        const client = getStitchToolClient();

        // Call the MCP tool directly to avoid SDK's buggy indexing
        const raw: any = await client.callTool(STITCH_MCP_TOOLS.GENERATE_SCREEN_FROM_TEXT, {
          projectId,
          prompt: request.prompt,
          deviceType: request.deviceType,
        });

        // Find the design component with screens (not always at index 0)
        const designComponent = raw.outputComponents?.find(
          (comp: any) => comp.design?.screens?.length > 0
        );

        if (!designComponent) {
          throw new StitchWrapperError(
            "Stitch response missing design component with screens",
            false,
            "INVALID_RESPONSE"
          );
        }

        const screen = designComponent.design.screens[0];
        const htmlUrl = screen.htmlCode?.downloadUrl ?? "";
        const screenshotUrl = screen.screenshot?.downloadUrl ?? "";
        const screenId = screen.id ?? screen.name?.split("/screens/")?.pop() ?? "";

        if (!htmlUrl) {
          throw new StitchWrapperError(
            "Stitch screen missing htmlCode.downloadUrl",
            false,
            "INVALID_RESPONSE"
          );
        }

        return {
          htmlUrl,
          screenshotUrl,
          projectId,
          screenId,
        };
      } catch (err) {
        if (err instanceof StitchError) {
          if (!err.recoverable) {
            throw new AbortError(
              new StitchWrapperError(err.message, false, err.code ?? "STITCH_ERROR")
            );
          }
          throw new StitchWrapperError(err.message, true, err.code ?? "STITCH_TRANSIENT");
        }
        if (err instanceof StitchWrapperError) throw err;
        if (err instanceof AbortError) throw err;
        throw new StitchWrapperError(
          "Unexpected error during Stitch API call",
          false,
          "UNKNOWN"
        );
      }
    },
    {
      retries: 2,        // 3 total attempts per D-13
      minTimeout: 1000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.error(
          `Stitch attempt ${error.attemptNumber}/${error.attemptNumber + error.retriesLeft} failed. ${error.retriesLeft} retries remaining.`
        );
      },
    }
  );
}
