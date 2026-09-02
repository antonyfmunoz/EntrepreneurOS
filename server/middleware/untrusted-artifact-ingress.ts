import type { RequestHandler } from "express";
import { untrustedArtifactUploadsEnabled } from "../security/release-configuration";

export const requireScannerBackedArtifactIngress: RequestHandler = (
  _req,
  res,
  next,
) => {
  if (untrustedArtifactUploadsEnabled()) return next();
  res.setHeader("Cache-Control", "no-store");
  res.status(409).json({
    code: "untrusted_artifact_uploads_disabled",
    message:
      "Direct file uploads are unavailable while EOS is in trusted-source mode. Submit an HTTPS reference or use an EOS-generated document instead.",
  });
};
