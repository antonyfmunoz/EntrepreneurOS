import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  readNativeEsignArtifact,
  removeNativeEsignArtifact,
  storeNativeEsignArtifact,
} from "./native-esign-files";
import { scanBufferForMalware, type MalwareScanResult } from "../security/malware-scanner";

export const CANDIDATE_FILE_MAX_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "audio/webm",
  "audio/mp4",
]);

export type CandidateFileMetadata = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

function normalizedCandidateFileBuffer(value: unknown): Buffer {
  if (!Buffer.isBuffer(value)) throw new Error("candidate_file_body_invalid");
  return Buffer.from(value);
}

export function candidateFileSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeCandidateFileName(value: string): string {
  const base = path
    .basename(value.trim())
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);
  return base || "candidate-evidence";
}

export function validateCandidateFile(
  buffer: unknown,
  claimedMimeType: string,
  originalName: string,
): CandidateFileMetadata {
  const bytes = normalizedCandidateFileBuffer(buffer);
  const mimeType = claimedMimeType.trim().toLowerCase();
  if (!allowedMimeTypes.has(mimeType))
    throw new Error("candidate_file_type_unsupported");
  if (!bytes.length || bytes.length > CANDIDATE_FILE_MAX_BYTES)
    throw new Error("candidate_file_size_invalid");
  const matches =
    mimeType === "application/pdf"
      ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
      : mimeType === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(
              Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            )
        : mimeType === "image/jpeg"
          ? bytes.length >= 3 &&
            bytes[0] === 0xff &&
            bytes[1] === 0xd8 &&
            bytes[2] === 0xff
          : mimeType === "audio/webm"
            ? bytes
                .subarray(0, 4)
                .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
            : mimeType === "audio/mp4"
              ? bytes.length >= 12 &&
                bytes.subarray(4, 8).toString("ascii") === "ftyp"
              : !bytes.includes(0) &&
                (() => {
                  try {
                    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
                    return true;
                  } catch {
                    return false;
                  }
                })();
  if (!matches) throw new Error("candidate_file_content_mismatch");
  return {
    fileName: sanitizeCandidateFileName(originalName),
    mimeType,
    sizeBytes: bytes.length,
    sha256: candidateFileSha256(bytes),
  };
}

function configuredRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.EOS_ARTIFACT_STORAGE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return env.NODE_ENV === "production"
    ? null
    : path.resolve(process.cwd(), ".eos-artifacts");
}

export function candidateFileStorageConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    configuredRoot(env) ||
      (env.EOS_ARTIFACT_STORAGE_PROVIDER === "s3" &&
        env.EOS_ARTIFACT_S3_BUCKET?.trim() &&
        env.EOS_ARTIFACT_S3_REGION?.trim()),
  );
}

function artifactPath(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
): { root: string; target: string } {
  const root = configuredRoot(env);
  if (!root) throw new Error("candidate_file_storage_not_configured");
  if (
    !/^[a-z0-9][a-z0-9/_-]{1,399}$/.test(storageKey) ||
    storageKey.includes("..")
  )
    throw new Error("candidate_file_storage_key_invalid");
  const target = path.resolve(root, storageKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`))
    throw new Error("candidate_file_storage_key_invalid");
  return { root, target };
}

export function candidateFileStorageKey(
  companyId: number,
  applicationId: string,
  evidenceId: string,
): string {
  return `candidate-evidence/${companyId}/${applicationId}/${evidenceId}`;
}

export async function storeCandidateFile(
  storageKey: string,
  buffer: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const bytes = normalizedCandidateFileBuffer(buffer);
  if (env.EOS_ARTIFACT_STORAGE_PROVIDER === "s3") {
    await storeNativeEsignArtifact(storageKey, bytes, env);
    return;
  }
  const { target } = artifactPath(storageKey, env);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function readCandidateFile(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  if (env.EOS_ARTIFACT_STORAGE_PROVIDER === "s3")
    return readNativeEsignArtifact(storageKey, env);
  return await readFile(artifactPath(storageKey, env).target);
}

export async function deleteCandidateFile(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.EOS_ARTIFACT_STORAGE_PROVIDER === "s3") {
    await removeNativeEsignArtifact(storageKey, env);
    return;
  }
  await rm(artifactPath(storageKey, env).target, { force: true });
}

export type CandidateFileScanResult = MalwareScanResult;

export async function scanCandidateFile(
  buffer: unknown,
  metadata: CandidateFileMetadata,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CandidateFileScanResult> {
  const bytes = normalizedCandidateFileBuffer(buffer);
  if (bytes.length !== metadata.sizeBytes || candidateFileSha256(bytes) !== metadata.sha256)
    throw new Error("candidate_file_metadata_mismatch");
  return scanBufferForMalware(bytes, metadata, env);
}

export function safeAttachmentHeader(fileName: string): string {
  const fallback = sanitizeCandidateFileName(fileName).replace(
    /[^A-Za-z0-9._ -]/g,
    "_",
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(sanitizeCandidateFileName(fileName))}`;
}
