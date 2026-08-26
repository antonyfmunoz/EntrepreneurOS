import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  candidateFileSha256,
  candidateFileStorageConfigured,
  deleteCandidateFile,
  readCandidateFile,
  safeAttachmentHeader,
  scanCandidateFile,
  storeCandidateFile,
  validateCandidateFile,
} from "../../server/artifacts/candidate-files";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0))
    await rm(root, { recursive: true, force: true });
});

describe("candidate artifact boundary", () => {
  it("validates declared type against file signatures and hashes accepted content", () => {
    const pdf = Buffer.from("%PDF-1.7\ncontrolled fixture");
    expect(
      validateCandidateFile(pdf, "application/pdf", "../Résumé 2026.pdf"),
    ).toEqual({
      fileName: "Résumé 2026.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      sha256: candidateFileSha256(pdf),
    });
    expect(() =>
      validateCandidateFile(
        Buffer.from("not a pdf"),
        "application/pdf",
        "resume.pdf",
      ),
    ).toThrow("candidate_file_content_mismatch");
    expect(() =>
      validateCandidateFile(Buffer.from([0, 1, 2]), "text/plain", "notes.txt"),
    ).toThrow("candidate_file_content_mismatch");
    expect(() =>
      validateCandidateFile(pdf, "application/x-msdownload", "resume.exe"),
    ).toThrow("candidate_file_type_unsupported");
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01]);
    const mp4 = Buffer.from([
      0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20,
    ]);
    expect(
      validateCandidateFile(webm, "audio/webm", "response.webm").mimeType,
    ).toBe("audio/webm");
    expect(
      validateCandidateFile(mp4, "audio/mp4", "response.m4a").mimeType,
    ).toBe("audio/mp4");
    expect(() =>
      validateCandidateFile(
        Buffer.from("fake audio"),
        "audio/webm",
        "response.webm",
      ),
    ).toThrow("candidate_file_content_mismatch");
  });

  it("rejects request-body values that are not actual binary buffers", async () => {
    expect(() =>
      validateCandidateFile("%PDF-1.7" as unknown, "application/pdf", "resume.pdf"),
    ).toThrow("candidate_file_body_invalid");
    await expect(
      storeCandidateFile(
        "candidate-evidence/1/application/evidence",
        [0x25, 0x50, 0x44, 0x46] as unknown,
        { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      ),
    ).rejects.toThrow("candidate_file_body_invalid");
    const bytes = Buffer.from("plain evidence", "utf8");
    const metadata = validateCandidateFile(bytes, "text/plain", "evidence.txt");
    await expect(
      scanCandidateFile({ bytes: [...bytes] } as unknown, metadata, {} as NodeJS.ProcessEnv),
    ).rejects.toThrow("candidate_file_body_invalid");
  });

  it("stores private bytes under a bounded key and rejects traversal", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "eos-candidate-file-"));
    temporaryRoots.push(root);
    const env = {
      NODE_ENV: "test",
      EOS_ARTIFACT_STORAGE_ROOT: root,
    } as NodeJS.ProcessEnv;
    const bytes = Buffer.from("safe text evidence", "utf8");
    expect(candidateFileStorageConfigured(env)).toBe(true);
    await storeCandidateFile(
      "candidate-evidence/1/application/evidence",
      bytes,
      env,
    );
    expect(
      await readCandidateFile("candidate-evidence/1/application/evidence", env),
    ).toEqual(bytes);
    await expect(storeCandidateFile("../escape", bytes, env)).rejects.toThrow(
      "candidate_file_storage_key_invalid",
    );
    await deleteCandidateFile("candidate-evidence/1/application/evidence", env);
  });

  it("keeps files quarantined when no malware scanner is configured", async () => {
    const bytes = Buffer.from("plain evidence", "utf8");
    const metadata = validateCandidateFile(bytes, "text/plain", "evidence.txt");
    expect(
      await scanCandidateFile(bytes, metadata, {} as NodeJS.ProcessEnv),
    ).toEqual({ state: "pending", engine: null, completedAt: null });
    expect(safeAttachmentHeader("résumé.pdf")).toContain(
      "filename*=UTF-8''r%C3%A9sum%C3%A9.pdf",
    );
    await expect(
      scanCandidateFile(
        Buffer.from("tampered evidence", "utf8"),
        metadata,
        {} as NodeJS.ProcessEnv,
      ),
    ).rejects.toThrow("candidate_file_metadata_mismatch");
  });
});
