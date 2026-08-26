import { createHash, timingSafeEqual } from "node:crypto";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import {
  NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_BYTES,
  NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_HEIGHT,
  NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_WIDTH,
  NATIVE_ESIGN_MIN_SIGNATURE_CAPTURE_HEIGHT,
  NATIVE_ESIGN_MIN_SIGNATURE_CAPTURE_WIDTH,
} from "@shared/native-esign";

export type NativeEsignSignatureCapture = {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg";
  sha256: string;
  sizeBytes: number;
  width: number;
  height: number;
};

export function typedSignatureCaptureSha256(signatureName: string): string {
  return createHash("sha256").update(`typed\0${signatureName.trim()}`, "utf8").digest("hex");
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  const magic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 29 || !bytes.subarray(0, 8).equals(magic) || bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function validatePngInflation(bytes: Buffer, width: number, height: number): void {
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28];
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (![1, 2, 4, 8, 16].includes(bitDepth) || !channels || compression !== 0 || filter !== 0 || ![0, 1].includes(interlace))
    throw new Error("native_esign_capture_content_invalid");
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("native_esign_capture_content_invalid");
    if (type === "IDAT") idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset = end;
    if (type === "IEND") break;
  }
  if (!idat.length) throw new Error("native_esign_capture_content_invalid");
  const bytesPerRow = Math.ceil((width * channels * bitDepth) / 8) + 1;
  const nonInterlacedMaximum = bytesPerRow * height;
  const maximumInflatedBytes = interlace === 0 ? nonInterlacedMaximum : nonInterlacedMaximum + height * 8 + 1024;
  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: maximumInflatedBytes });
  } catch {
    throw new Error("native_esign_capture_content_invalid");
  }
  if (!inflated.length || inflated.length > maximumInflatedBytes)
    throw new Error("native_esign_capture_content_invalid");
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (startOfFrame.has(marker)) {
      if (length < 7) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function decodeCanonicalBase64(encoded: string): Buffer {
  const bytes = Buffer.from(encoded, "base64");
  const normalizedInput = encoded.replace(/=+$/, "");
  const normalizedOutput = bytes.toString("base64").replace(/=+$/, "");
  if (!bytes.length || normalizedInput !== normalizedOutput) throw new Error("native_esign_capture_encoding_invalid");
  return bytes;
}

export async function validateNativeEsignSignatureCapture(input: {
  method: "drawn" | "uploaded";
  mimeType: "image/png" | "image/jpeg";
  base64: string;
  claimedSha256: string;
}): Promise<NativeEsignSignatureCapture> {
  if (input.method === "drawn" && input.mimeType !== "image/png")
    throw new Error("native_esign_capture_type_invalid");
  const bytes = decodeCanonicalBase64(input.base64);
  if (bytes.length > NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_BYTES)
    throw new Error("native_esign_capture_size_invalid");
  const dimensions = input.mimeType === "image/png" ? pngDimensions(bytes) : jpegDimensions(bytes);
  if (!dimensions) throw new Error("native_esign_capture_content_invalid");
  if (
    dimensions.width < NATIVE_ESIGN_MIN_SIGNATURE_CAPTURE_WIDTH || dimensions.width > NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_WIDTH ||
    dimensions.height < NATIVE_ESIGN_MIN_SIGNATURE_CAPTURE_HEIGHT || dimensions.height > NATIVE_ESIGN_MAX_SIGNATURE_CAPTURE_HEIGHT
  ) throw new Error("native_esign_capture_dimensions_invalid");
  if (input.mimeType === "image/png") validatePngInflation(bytes, dimensions.width, dimensions.height);

  try {
    const validationDocument = await PDFDocument.create();
    if (input.mimeType === "image/png") await validationDocument.embedPng(bytes);
    else await validationDocument.embedJpg(bytes);
  } catch {
    throw new Error("native_esign_capture_content_invalid");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const claimed = Buffer.from(input.claimedSha256, "hex");
  const actual = Buffer.from(sha256, "hex");
  if (claimed.length !== actual.length || !timingSafeEqual(claimed, actual))
    throw new Error("native_esign_capture_hash_mismatch");
  return { bytes, mimeType: input.mimeType, sha256, sizeBytes: bytes.length, ...dimensions };
}
