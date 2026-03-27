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
