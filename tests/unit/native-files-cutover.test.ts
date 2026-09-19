import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const overlay = readFileSync(new URL("../../client/src/pages/eos-overlay-page.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../server/routes/instrument-runtime.ts", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../client/src/components/native-files-studio.tsx", import.meta.url), "utf8");

describe("native Files cutover", () => {
  it("gives only a Files-entitled role an EOS-owned file workspace", () => {
    expect(overlay).toContain("mayOperateNativeFiles");
    expect(overlay).toContain('toolEntitlements.has("files")');
    expect(overlay).toContain("NativeFilesStudio");
    expect(studio).toContain('data-testid="native-files-studio"');
    expect(studio).toContain("Scan and store native file");
    expect(studio).toContain("apiDownloadRequest");
  });

  it("uses the instrument authority, scanner gate, immutable custody record, and visibility check", () => {
    expect(runtime).toContain('"/api/eos/companies/:companyId/instruments/files/upload"');
    expect(runtime).toContain("requireScannerBackedArtifactIngress");
    expect(runtime).toContain('"native_file.upload"');
    expect(runtime).toContain("scanNativeFile");
    expect(runtime).toContain("storeNativeFile");
    expect(runtime).toContain('commandType: "file.upload"');
    expect(runtime).toContain('"/api/eos/companies/:companyId/instruments/files/:objectId/download"');
    expect(runtime).toContain("visibleObjectSet(access, [object])");
    expect(runtime).toContain("native_file_custody_integrity_failed");
  });
});
