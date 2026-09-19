import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  nativeFileSha256,
  nativeFileStorageConfigured,
  nativeFileStorageKey,
  readNativeFile,
  removeNativeFile,
  safeNativeFileAttachmentHeader,
  sanitizeNativeFileName,
  scanNativeFile,
  storeNativeFile,
  validateNativeFile,
} from "../../server/artifacts/native-files";

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("EOS native Files custody", () => {
  it("accepts only bounded, verified file types and strips path control from display names", () => {
    const pdf = Buffer.from("%PDF-1.7\nEOS controlled file");
    expect(validateNativeFile(pdf, "application/pdf", "../Operating brief.pdf")).toEqual({
      fileName: "Operating brief.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      sha256: nativeFileSha256(pdf),
    });
    expect(sanitizeNativeFileName("..\\quarterly:brief?.pdf")).toBe("quarterly-brief-.pdf");
    expect(() => validateNativeFile(Buffer.from("not a pdf"), "application/pdf", "brief.pdf")).toThrow("native_file_content_mismatch");
    expect(() => validateNativeFile(Buffer.from([0, 1, 2]), "text/csv", "data.csv")).toThrow("native_file_content_mismatch");
    expect(() => validateNativeFile(pdf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "brief.docx")).toThrow("native_file_type_unsupported");
  });

  it("stores immutable bytes inside the EOS artifact custody plane", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eos-native-files-"));
    roots.push(root);
    const env = { NODE_ENV: "test", EOS_ARTIFACT_STORAGE_ROOT: root } as NodeJS.ProcessEnv;
    const objectId = "3d48f965-7f2c-4d96-9e3f-8aec6b5d3f9c";
    const key = nativeFileStorageKey(42, objectId);
    const bytes = Buffer.from("native EOS operating note", "utf8");
    expect(nativeFileStorageConfigured(env)).toBe(true);
    await storeNativeFile(key, bytes, env);
    expect(await readNativeFile(key, env)).toEqual(bytes);
    await expect(storeNativeFile(key, Buffer.from("different content"), env)).rejects.toThrow("native_esign_artifact_immutable_conflict");
    await removeNativeFile(key, env);
    expect(nativeFileStorageKey(42, objectId)).toBe(`native-files/42/objects/${objectId}/content`);
    expect(() => nativeFileStorageKey(0, objectId)).toThrow("native_file_company_invalid");
  });

  it("keeps a direct upload unavailable until the scanner can issue a clean result", async () => {
    const bytes = Buffer.from("scanned content", "utf8");
    const metadata = validateNativeFile(bytes, "text/plain", "notes.txt");
    expect(await scanNativeFile(bytes, metadata, {} as NodeJS.ProcessEnv)).toEqual({
      state: "pending",
      engine: null,
      completedAt: null,
    });
    await expect(scanNativeFile(Buffer.from("tampered"), metadata, {} as NodeJS.ProcessEnv)).rejects.toThrow("native_file_metadata_mismatch");
    expect(safeNativeFileAttachmentHeader("résumé.pdf")).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
  });
});
