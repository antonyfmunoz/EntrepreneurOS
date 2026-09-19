import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import {
  nativeEsignStorageProvider,
  readNativeEsignArtifact,
  removeNativeEsignArtifact,
  storeNativeEsignArtifact,
} from "./native-esign-files";
import {
  scanBufferForMalware,
  type MalwareScanResult,
} from "../security/malware-scanner";

/**
 * Native Files is deliberately a small, conservative custody surface.  It is
 * not a catch-all for arbitrary executable or office-document ingest: those
 * formats need a separate content-disarm and parsing policy before EOS can
 * safely make them first-class records.  These types cover the operating
 * artifacts EOS can validate and render without silently trusting an external
 * drive.
 */
export const NATIVE_FILE_MAX_BYTES = 10 * 1024 * 1024;

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
  "text/markdown",
  "text/csv",
  "audio/webm",
  "audio/mp4",
]);

export type NativeFileMetadata = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

function normalizedBuffer(value: unknown): Buffer {
  if (!Buffer.isBuffer(value)) throw new Error("native_file_body_invalid");
  return Buffer.from(value);
}

export function nativeFileSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sanitizeNativeFileName(value: string): string {
  const base = path
    .basename(value.trim())
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?\"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180);
  return base || "eos-file";
}

function isUtf8Text(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function validateNativeFile(
  buffer: unknown,
  claimedMimeType: string,
  originalName: string,
): NativeFileMetadata {
  const bytes = normalizedBuffer(buffer);
  const mimeType = claimedMimeType.trim().toLowerCase();
  if (!allowedMimeTypes.has(mimeType))
    throw new Error("native_file_type_unsupported");
  if (!bytes.length || bytes.length > NATIVE_FILE_MAX_BYTES)
    throw new Error("native_file_size_invalid");
  const matches =
    mimeType === "application/pdf"
      ? bytes.subarray(0, 5).toString("ascii") === "%PDF-"
      : mimeType === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : mimeType === "image/jpeg"
          ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          : mimeType === "audio/webm"
            ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
            : mimeType === "audio/mp4"
              ? bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp"
              : isUtf8Text(bytes);
  if (!matches) throw new Error("native_file_content_mismatch");
  return {
    fileName: sanitizeNativeFileName(originalName),
    mimeType,
    sizeBytes: bytes.length,
    sha256: nativeFileSha256(bytes),
  };
}

/**
 * Use the EOS artifact custody plane, rather than a page-local filesystem.
 * That makes native files work with the same encrypted primary storage and
 * backup/recovery controls already qualified for EOS-owned artifacts.
 */
export function nativeFileStorageConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    nativeEsignStorageProvider(env, "primary");
    return true;
  } catch {
    return false;
  }
}

export function nativeFileStorageKey(companyId: number, fileObjectId: string): string {
  if (!Number.isInteger(companyId) || companyId <= 0)
    throw new Error("native_file_company_invalid");
  if (!/^[a-f0-9-]{36}$/i.test(fileObjectId))
    throw new Error("native_file_object_id_invalid");
  return `native-files/${companyId}/objects/${fileObjectId}/content`;
}

export async function storeNativeFile(
  storageKey: string,
  buffer: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await storeNativeEsignArtifact(storageKey, normalizedBuffer(buffer), env);
}

export async function readNativeFile(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Buffer> {
  return readNativeEsignArtifact(storageKey, env);
}

export async function removeNativeFile(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await removeNativeEsignArtifact(storageKey, env);
}

export async function scanNativeFile(
  buffer: unknown,
  metadata: NativeFileMetadata,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MalwareScanResult> {
  const bytes = normalizedBuffer(buffer);
  if (bytes.length !== metadata.sizeBytes || nativeFileSha256(bytes) !== metadata.sha256)
    throw new Error("native_file_metadata_mismatch");
  return scanBufferForMalware(bytes, metadata, env);
}

export function safeNativeFileAttachmentHeader(fileName: string): string {
  const safe = sanitizeNativeFileName(fileName);
  const fallback = safe.replace(/[^A-Za-z0-9._ -]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export function nativeFileObjectKey(): string {
  return `file:${randomUUID()}`;
}
