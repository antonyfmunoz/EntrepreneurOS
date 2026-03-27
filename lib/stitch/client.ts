import { Stitch, StitchError, StitchToolClient } from "@google/stitch-sdk";
import pRetry, { AbortError } from "p-retry";
import type { StitchGenerateRequest, StitchGenerateResult } from "./types.js";
import { StitchWrapperError } from "./types.js";

/**
 * Creates a Stitch client instance from the STITCH_API_KEY env var.
 * Instantiated per-call so the wrapper is testable without env vars
 * set at module load time.
 *
 * Note: SDK requires new Stitch(new StitchToolClient({ apiKey })) — the
 * Stitch class takes a StitchToolClient, not a raw config object.
 *
 * @throws StitchWrapperError if STITCH_API_KEY is not set (secret-safe message)
 */
function getStitchClient(): Stitch {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new StitchWrapperError(
      "STITCH_API_KEY environment variable is not set. Get your key from stitch.withgoogle.com account settings.",
      false,
      "ENV_MISSING"
    );
  }
  return new Stitch(new StitchToolClient({ apiKey }));
}

/**
 * Generate a UI screen via the Stitch API with automatic retry on transient errors.
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
        const client = getStitchClient();
        const project = client.project(projectId);
        const screen = await project.generate(request.prompt, request.deviceType);
        const [htmlUrl, screenshotUrl] = await Promise.all([
          screen.getHtml(),
          screen.getImage(),
        ]);
        return {
          htmlUrl,
          screenshotUrl,
          projectId: screen.projectId,
          screenId: screen.screenId,
        };
      } catch (err) {
        if (err instanceof StitchError) {
          if (!err.recoverable) {
            // Non-recoverable: AUTH_FAILED, NOT_FOUND, PERMISSION_DENIED, VALIDATION_ERROR
            // Wrap in AbortError to stop p-retry. Message is secret-safe (StitchError messages don't contain keys).
            throw new AbortError(
              new StitchWrapperError(err.message, false, err.code ?? "STITCH_ERROR")
            );
          }
          // Recoverable: RATE_LIMITED, NETWORK_ERROR — let p-retry handle
          throw new StitchWrapperError(err.message, true, err.code ?? "STITCH_TRANSIENT");
        }
        // Unknown errors — do not leak internal details
        if (err instanceof StitchWrapperError) throw err;
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
        // Log attempt count but NOT error details that might contain secrets
        console.error(
          `Stitch attempt ${error.attemptNumber}/${error.attemptNumber + error.retriesLeft} failed. ${error.retriesLeft} retries remaining.`
        );
      },
    }
  );
}
