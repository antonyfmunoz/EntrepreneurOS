import express from "express";
import supertest from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { requireScannerBackedArtifactIngress } from "../../server/middleware/untrusted-artifact-ingress";
import { malwareScannerConfigured, productionRuntimeConfigurationIssues, untrustedArtifactIngressMode, untrustedArtifactUploadsEnabled } from "../../server/security/release-configuration";

afterEach(() => vi.unstubAllEnvs());

describe("trusted-source artifact policy", () => {
  it("requires an explicit declaration and never opens uploads without scanning", () => {
    for (const value of [undefined, "", "yes", "FALSE", "0", "true"]) {
      const env = { EOS_UNTRUSTED_UPLOADS_ENABLED: value };
      expect(untrustedArtifactUploadsEnabled(env)).toBe(false);
      expect(untrustedArtifactIngressMode(env)).toBe("unsafe");
      expect(productionRuntimeConfigurationIssues(env)).toContain("untrustedArtifactIngressSafe");
    }
  });

  it("recognizes disabled uploads as safe without fabricating a scanner", () => {
    const env = { EOS_UNTRUSTED_UPLOADS_ENABLED: "false" };
    expect(malwareScannerConfigured(env)).toBe(false);
    expect(untrustedArtifactUploadsEnabled(env)).toBe(false);
    expect(untrustedArtifactIngressMode(env)).toBe("trusted_source");
    expect(productionRuntimeConfigurationIssues(env)).not.toContain("untrustedArtifactIngressSafe");
  });

  it("requires a real scanner configuration outside explicit test fixtures", () => {
    const enabled = { EOS_UNTRUSTED_UPLOADS_ENABLED: "true", EOS_MALWARE_SCAN_MODE: "clamav" };
    expect(untrustedArtifactUploadsEnabled(enabled)).toBe(true);
    expect(untrustedArtifactUploadsEnabled({ ...enabled, EOS_UNTRUSTED_UPLOADS_ENABLED: "false" })).toBe(false);
    const fixture = { EOS_UNTRUSTED_UPLOADS_ENABLED: "true", EOS_MALWARE_SCAN_MODE: "test-fixture" };
    expect(untrustedArtifactUploadsEnabled({ ...fixture, NODE_ENV: "test" })).toBe(true);
    expect(untrustedArtifactUploadsEnabled({ ...fixture, NODE_ENV: "production" })).toBe(false);
  });

  it("rejects before the raw parser and artifact handler execute", async () => {
    vi.stubEnv("EOS_UNTRUSTED_UPLOADS_ENABLED", "false");
    const parserReached = vi.fn();
    const artifactHandler = vi.fn();
    const app = express();
    app.post("/upload", requireScannerBackedArtifactIngress,
      express.raw({ type: "application/pdf", verify: parserReached }),
      (_req, res) => { artifactHandler(); res.sendStatus(201); });
    const response = await supertest(app).post("/upload").set("Content-Type", "application/pdf").send(Buffer.from("never parsed")).expect(409);
    expect(response.body.code).toBe("untrusted_artifact_uploads_disabled");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(parserReached).not.toHaveBeenCalled();
    expect(artifactHandler).not.toHaveBeenCalled();
  });

  it("wires the gate ahead of every binary route and keeps generated routes separate", () => {
    const signing = readFileSync(new URL("../../server/routes/native-esign.ts", import.meta.url), "utf8");
    const candidate = readFileSync(new URL("../../server/routes/talent-portal.ts", import.meta.url), "utf8");
    for (const source of [signing, candidate]) {
      expect(source.match(/requireScannerBackedArtifactIngress,\s*express\.raw/g)?.length).toBe(source.match(/express\.raw\(/g)?.length);
    }
    expect(signing).toContain('input.signatureMethod !== "typed" && !untrustedArtifactUploadsEnabled()');
    expect(signing).toContain('/template-versions/:versionId/generate');
    expect(signing).toContain('/documents/:sourceDocumentVersionId/generated-revisions');
  });
});
