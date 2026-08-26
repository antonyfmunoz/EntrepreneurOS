import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetBucketEncryptionCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PDFDocument } from "pdf-lib";
import { NATIVE_ESIGN_MAX_DOCUMENT_BYTES } from "@shared/native-esign";

export type NativeEsignPdfMetadata = {
  sizeBytes: number;
  sha256: string;
  mimeType: "application/pdf";
  pageCount?: number;
};

export function validateNativeEsignPdf(buffer: Buffer): NativeEsignPdfMetadata {
  if (!buffer.length || buffer.length > NATIVE_ESIGN_MAX_DOCUMENT_BYTES)
    throw new Error("native_esign_document_size_invalid");
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new Error("native_esign_document_content_invalid");
  return {
    sizeBytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    mimeType: "application/pdf",
  };
}

export async function inspectNativeEsignPdf(buffer: Buffer): Promise<Required<NativeEsignPdfMetadata>> {
  const metadata = validateNativeEsignPdf(buffer);
  let pageCount: number;
  try {
    const document = await PDFDocument.load(buffer, { updateMetadata: false });
    pageCount = document.getPageCount();
  } catch {
    throw new Error("native_esign_document_content_invalid");
  }
  if (pageCount < 1 || pageCount > 2_000)
    throw new Error("native_esign_document_page_count_invalid");
  return { ...metadata, pageCount };
}

export type NativeEsignStoragePlane = "primary" | "backup";
export type NativeEsignStorageProvider = "filesystem" | "s3";
export type NativeEsignStorageCapabilityStatus = "enabled" | "disabled" | "not_applicable" | "unavailable" | "unknown";
export type NativeEsignStorageCapabilitySnapshot = {
  plane: NativeEsignStoragePlane;
  provider: NativeEsignStorageProvider;
  identitySha256: string;
  reachable: boolean;
  shared: boolean;
  requestedEncryption: "filesystem_operator_managed" | "sse_s3" | "sse_kms";
  defaultEncryption: NativeEsignStorageCapabilityStatus;
  versioning: NativeEsignStorageCapabilityStatus;
  objectLock: NativeEsignStorageCapabilityStatus;
  lifecycle: NativeEsignStorageCapabilityStatus;
  failureCode: string;
};

type StorageConfiguration =
  | { provider: "filesystem"; root: string }
  | { provider: "s3"; bucket: string; region: string; endpoint?: string; prefix: string; forcePathStyle: boolean };

function envKey(plane: NativeEsignStoragePlane, suffix: string): string {
  return plane === "primary" ? `EOS_ARTIFACT_${suffix}` : `EOS_ARTIFACT_BACKUP_${suffix}`;
}

function storageRoot(env: NodeJS.ProcessEnv, plane: NativeEsignStoragePlane): string {
  const configured = env[envKey(plane, "STORAGE_ROOT")]?.trim();
  if (configured) return path.resolve(configured);
  if (plane === "backup") throw new Error("native_esign_backup_not_configured");
  if (env.NODE_ENV === "production")
    throw new Error("native_esign_storage_not_configured");
  return path.resolve(process.cwd(), ".eos-artifacts");
}

function validateStorageKey(storageKey: string): void {
  if (!/^[a-z0-9][a-z0-9/_.-]{1,399}$/.test(storageKey) || storageKey.includes(".."))
    throw new Error("native_esign_storage_key_invalid");
}

function resolvedArtifactPath(storageKey: string, env: NodeJS.ProcessEnv, plane: NativeEsignStoragePlane): string {
  validateStorageKey(storageKey);
  const root = storageRoot(env, plane);
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error("native_esign_storage_key_invalid");
  return target;
}

function storageConfiguration(env: NodeJS.ProcessEnv, plane: NativeEsignStoragePlane): StorageConfiguration {
  const provider = (env[envKey(plane, "STORAGE_PROVIDER")] || "filesystem").trim().toLowerCase();
  if (provider === "filesystem") return { provider, root: storageRoot(env, plane) };
  if (provider !== "s3") throw new Error(`native_esign_${plane}_provider_invalid`);
  const bucket = env[envKey(plane, "S3_BUCKET")]?.trim();
  const region = env[envKey(plane, "S3_REGION")]?.trim();
  if (!bucket || !region) throw new Error(`native_esign_${plane}_s3_not_configured`);
  const prefix = (env[envKey(plane, "S3_PREFIX")] || "").trim().replace(/^\/+|\/+$/g, "");
  if (prefix && (!/^[a-z0-9][a-z0-9/_.-]{0,199}$/i.test(prefix) || prefix.includes("..")))
    throw new Error(`native_esign_${plane}_s3_prefix_invalid`);
  return {
    provider, bucket, region, prefix,
    endpoint: env[envKey(plane, "S3_ENDPOINT")]?.trim() || undefined,
    forcePathStyle: env[envKey(plane, "S3_FORCE_PATH_STYLE")] === "true",
  };
}

function s3Key(configuration: Extract<StorageConfiguration, { provider: "s3" }>, storageKey: string): string {
  validateStorageKey(storageKey);
  return configuration.prefix ? `${configuration.prefix}/${storageKey}` : storageKey;
}

function s3Client(configuration: Extract<StorageConfiguration, { provider: "s3" }>): S3Client {
  return new S3Client({ region: configuration.region, endpoint: configuration.endpoint, forcePathStyle: configuration.forcePathStyle });
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function nativeEsignStorageProvider(env: NodeJS.ProcessEnv = process.env, plane: NativeEsignStoragePlane = "primary"): NativeEsignStorageProvider {
  return storageConfiguration(env, plane).provider;
}

export function nativeEsignBackupConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try { storageConfiguration(env, "backup"); return true; } catch { return false; }
}

export function nativeEsignStorageIdentitySha256(
  env: NodeJS.ProcessEnv = process.env,
  plane: NativeEsignStoragePlane = "primary",
): string {
  const configuration = storageConfiguration(env, plane);
  const identity = configuration.provider === "filesystem"
    ? { provider: configuration.provider, root: configuration.root }
    : {
        provider: configuration.provider,
        bucket: configuration.bucket,
        region: configuration.region,
        endpoint: configuration.endpoint || "aws",
        prefix: configuration.prefix,
      };
  return createHash("sha256").update(JSON.stringify(identity), "utf8").digest("hex");
}

function safeProviderFailureCode(error: unknown): string {
  const value = error as { name?: unknown; Code?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  const candidate = [value?.name, value?.Code, value?.code]
    .find((item) => typeof item === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(item));
  if (candidate) return String(candidate).toLowerCase();
  const status = value?.$metadata?.httpStatusCode;
  return typeof status === "number" ? `http_${status}` : "provider_probe_failed";
}

export async function probeNativeEsignStoragePlane(
  env: NodeJS.ProcessEnv = process.env,
  plane: NativeEsignStoragePlane = "primary",
): Promise<NativeEsignStorageCapabilitySnapshot> {
  const configuration = storageConfiguration(env, plane);
  const identitySha256 = nativeEsignStorageIdentitySha256(env, plane);
  if (configuration.provider === "filesystem") {
    try {
      await mkdir(configuration.root, { recursive: true, mode: 0o700 });
      const details = await stat(configuration.root);
      if (!details.isDirectory()) throw new Error("filesystem_root_not_directory");
      return {
        plane, provider: "filesystem", identitySha256, reachable: true, shared: false,
        requestedEncryption: "filesystem_operator_managed", defaultEncryption: "not_applicable",
        versioning: "not_applicable", objectLock: "not_applicable", lifecycle: "not_applicable", failureCode: "",
      };
    } catch (error) {
      return {
        plane, provider: "filesystem", identitySha256, reachable: false, shared: false,
        requestedEncryption: "filesystem_operator_managed", defaultEncryption: "not_applicable",
        versioning: "not_applicable", objectLock: "not_applicable", lifecycle: "not_applicable",
        failureCode: safeProviderFailureCode(error),
      };
    }
  }

  const client = s3Client(configuration);
  const bucket = configuration.bucket;
  const capability = async (
    command: unknown,
    evaluate: (response: any) => boolean,
  ): Promise<NativeEsignStorageCapabilityStatus> => {
    try {
      const response = await client.send(command as any);
      return evaluate(response) ? "enabled" : "disabled";
    } catch {
      return "unavailable";
    }
  };
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      return {
        plane, provider: "s3", identitySha256, reachable: false, shared: true,
        requestedEncryption: env[envKey(plane, "S3_KMS_KEY_ID")]?.trim() ? "sse_kms" : "sse_s3",
        defaultEncryption: "unknown", versioning: "unknown", objectLock: "unknown", lifecycle: "unknown",
        failureCode: safeProviderFailureCode(error),
      };
    }
    const [defaultEncryption, versioning, objectLock, lifecycle] = await Promise.all([
      capability(new GetBucketEncryptionCommand({ Bucket: bucket }), (response) => Boolean(response.ServerSideEncryptionConfiguration?.Rules?.length)),
      capability(new GetBucketVersioningCommand({ Bucket: bucket }), (response) => response.Status === "Enabled"),
      capability(new GetObjectLockConfigurationCommand({ Bucket: bucket }), (response) => response.ObjectLockConfiguration?.ObjectLockEnabled === "Enabled" && Boolean(response.ObjectLockConfiguration?.Rule?.DefaultRetention)),
      capability(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }), (response) => Boolean(response.Rules?.some((rule: any) => rule.Status === "Enabled"))),
    ]);
    return {
      plane, provider: "s3", identitySha256, reachable: true, shared: true,
      requestedEncryption: env[envKey(plane, "S3_KMS_KEY_ID")]?.trim() ? "sse_kms" : "sse_s3",
      defaultEncryption, versioning, objectLock, lifecycle, failureCode: "",
    };
  } finally {
    client.destroy();
  }
}

export function nativeEsignSourceStorageKey(companyId: number, documentVersionId: string): string {
  return `native-esign/${companyId}/documents/${documentVersionId}/source.pdf`;
}

export function nativeEsignFinalStorageKey(companyId: number, envelopeId: string, sha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("native_esign_artifact_sha256_invalid");
  return `native-esign/${companyId}/envelopes/${envelopeId}/completed-${sha256}.pdf`;
}

export function nativeEsignAuditStorageKey(companyId: number, envelopeId: string): string {
  return `native-esign/${companyId}/envelopes/${envelopeId}/audit.json`;
}

export function nativeEsignSignatureStorageKey(
  companyId: number,
  envelopeId: string,
  recipientId: string,
  captureId: string,
  mimeType: "image/png" | "image/jpeg",
): string {
  if (!/^[a-f0-9-]{36}$/.test(captureId)) throw new Error("native_esign_capture_id_invalid");
  const extension = mimeType === "image/png" ? "png" : "jpg";
  return `native-esign/${companyId}/envelopes/${envelopeId}/signatures/${recipientId}-${captureId}.${extension}`;
}

export async function storeNativeEsignArtifact(
  storageKey: string,
  buffer: Buffer,
  env: NodeJS.ProcessEnv = process.env,
  plane: NativeEsignStoragePlane = "primary",
): Promise<void> {
  const configuration = storageConfiguration(env, plane);
  if (configuration.provider === "s3") {
    const client = s3Client(configuration);
    try {
      await client.send(new PutObjectCommand({
        Bucket: configuration.bucket, Key: s3Key(configuration, storageKey), Body: buffer,
        ContentLength: buffer.length, Metadata: { sha256: sha256(buffer) }, IfNoneMatch: "*",
        ServerSideEncryption: env[envKey(plane, "S3_KMS_KEY_ID")] ? "aws:kms" : "AES256",
        SSEKMSKeyId: env[envKey(plane, "S3_KMS_KEY_ID")]?.trim() || undefined,
      }));
      return;
    } catch (error: any) {
      if (!["PreconditionFailed", "ConditionalRequestConflict"].includes(error?.name) && error?.$metadata?.httpStatusCode !== 412) throw error;
      const existing = await readNativeEsignArtifact(storageKey, env, plane);
      if (existing.length !== buffer.length || sha256(existing) !== sha256(buffer))
        throw new Error("native_esign_artifact_immutable_conflict");
      return;
    } finally {
      client.destroy();
    }
  }
  const target = resolvedArtifactPath(storageKey, env, plane);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(buffer); await handle.sync(); } finally { await handle.close(); }
  try {
    await copyFile(temporary, target, fsConstants.COPYFILE_EXCL);
  } catch (error: any) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(target);
    if (existing.length !== buffer.length || sha256(existing) !== sha256(buffer))
      throw new Error("native_esign_artifact_immutable_conflict");
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function readNativeEsignArtifact(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
  plane: NativeEsignStoragePlane = "primary",
): Promise<Buffer> {
  const configuration = storageConfiguration(env, plane);
  if (configuration.provider === "filesystem") return readFile(resolvedArtifactPath(storageKey, env, plane));
  const client = s3Client(configuration);
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: configuration.bucket, Key: s3Key(configuration, storageKey) }));
    if (!response.Body) throw new Error("native_esign_artifact_unavailable");
    return Buffer.from(await response.Body.transformToByteArray());
  } finally { client.destroy(); }
}

export async function inspectStoredNativeEsignArtifact(storageKey: string, env: NodeJS.ProcessEnv = process.env, plane: NativeEsignStoragePlane = "primary"): Promise<{ sizeBytes: number; sha256: string }> {
  const configuration = storageConfiguration(env, plane);
  if (configuration.provider === "filesystem") {
    const target = resolvedArtifactPath(storageKey, env, plane);
    const details = await stat(target);
    if (!details.isFile()) throw new Error("native_esign_artifact_unavailable");
    const buffer = await readFile(target);
    return { sizeBytes: buffer.length, sha256: sha256(buffer) };
  }
  const client = s3Client(configuration);
  try {
    const response = await client.send(new HeadObjectCommand({ Bucket: configuration.bucket, Key: s3Key(configuration, storageKey) }));
    const recordedHash = response.Metadata?.sha256;
    if (recordedHash && /^[a-f0-9]{64}$/.test(recordedHash)) return { sizeBytes: response.ContentLength || 0, sha256: recordedHash };
  } finally { client.destroy(); }
  const buffer = await readNativeEsignArtifact(storageKey, env, plane);
  return { sizeBytes: buffer.length, sha256: sha256(buffer) };
}

export async function backUpNativeEsignArtifact(storageKey: string, expectedSha256: string, env: NodeJS.ProcessEnv = process.env): Promise<{ sizeBytes: number; sha256: string }> {
  const primary = await readNativeEsignArtifact(storageKey, env, "primary");
  if (sha256(primary) !== expectedSha256) throw new Error("native_esign_primary_hash_mismatch");
  await storeNativeEsignArtifact(storageKey, primary, env, "backup");
  const backup = await inspectStoredNativeEsignArtifact(storageKey, env, "backup");
  if (backup.sha256 !== expectedSha256 || backup.sizeBytes !== primary.length) throw new Error("native_esign_backup_verification_failed");
  return backup;
}

export async function restoreNativeEsignArtifact(storageKey: string, expectedSha256: string, env: NodeJS.ProcessEnv = process.env): Promise<{ sizeBytes: number; sha256: string }> {
  const backup = await readNativeEsignArtifact(storageKey, env, "backup");
  if (sha256(backup) !== expectedSha256) throw new Error("native_esign_backup_hash_mismatch");
  try {
    const primary = await readNativeEsignArtifact(storageKey, env, "primary");
    if (sha256(primary) !== expectedSha256) throw new Error("native_esign_primary_immutable_conflict");
  } catch (error: any) {
    if (error?.message === "native_esign_primary_immutable_conflict") throw error;
    await storeNativeEsignArtifact(storageKey, backup, env, "primary");
  }
  return inspectStoredNativeEsignArtifact(storageKey, env, "primary");
}

export async function removeNativeEsignArtifact(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
  plane: NativeEsignStoragePlane = "primary",
): Promise<void> {
  const configuration = storageConfiguration(env, plane);
  if (configuration.provider === "filesystem") {
    await rm(resolvedArtifactPath(storageKey, env, plane), { force: true });
    return;
  }
  const client = s3Client(configuration);
  try { await client.send(new DeleteObjectCommand({ Bucket: configuration.bucket, Key: s3Key(configuration, storageKey) })); }
  finally { client.destroy(); }
}

// Deliberately unavailable outside tests: production writes are immutable.
export async function unsafeReplaceNativeEsignArtifactForTest(storageKey: string, buffer: Buffer, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.NODE_ENV !== "test") throw new Error("native_esign_test_mutation_forbidden");
  const configuration = storageConfiguration(env, "primary");
  if (configuration.provider !== "filesystem") throw new Error("native_esign_test_mutation_filesystem_required");
  const target = resolvedArtifactPath(storageKey, env, "primary");
  await rm(target, { force: true });
  await storeNativeEsignArtifact(storageKey, buffer, env, "primary");
}
