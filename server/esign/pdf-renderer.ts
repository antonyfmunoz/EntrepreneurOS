import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { z } from "zod";
import type { nativeEsignFieldSchema } from "@shared/native-esign";

type Field = z.infer<typeof nativeEsignFieldSchema>;

export type NativeEsignCompletedRecipient = {
  id: string;
  roleKey: string;
  signerName: string;
  signerEmail: string;
  signatureName: string;
  signatureMethod: string;
  signatureSha256: string;
  signatureCaptureSha256: string;
  signatureCaptureMimeType: string;
  signatureCaptureWidth: number;
  signatureCaptureHeight: number;
  signatureCaptureBytes?: Buffer;
  consentVersion: string;
  signedAt: Date;
  fieldValues: Record<string, string | boolean>;
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 6).toUpperCase();
}

const CERTIFICATE_RECIPIENTS_PER_PAGE = 7;

export async function renderNativeEsignCompletedPdf(input: {
  sourcePdf: Buffer;
  envelopeId: string;
  sourceSha256: string;
  completedAt: Date;
  fields: Field[];
  recipients: NativeEsignCompletedRecipient[];
}): Promise<Buffer> {
  const document = await PDFDocument.load(input.sourcePdf, { updateMetadata: false });
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const signatureFont = await document.embedFont(StandardFonts.HelveticaOblique);
  const recipientByRole = new Map(input.recipients.map((recipient) => [recipient.roleKey, recipient]));
  const captureByRecipient = new Map<string, Awaited<ReturnType<typeof document.embedPng>>>();
  for (const recipient of input.recipients) {
    if (!["drawn", "uploaded"].includes(recipient.signatureMethod)) continue;
    if (!recipient.signatureCaptureBytes) throw new Error("native_esign_capture_artifact_missing");
    const capture = recipient.signatureCaptureMimeType === "image/png"
      ? await document.embedPng(recipient.signatureCaptureBytes)
      : recipient.signatureCaptureMimeType === "image/jpeg"
        ? await document.embedJpg(recipient.signatureCaptureBytes)
        : null;
    if (!capture) throw new Error("native_esign_capture_type_invalid");
    captureByRecipient.set(recipient.id, capture);
  }

  for (const field of input.fields) {
    const page = document.getPages()[field.page - 1];
    const recipient = recipientByRole.get(field.roleKey);
    if (!page || !recipient) throw new Error("native_esign_field_binding_invalid");
    const { width, height } = page.getSize();
    const value = field.type === "signature"
      ? recipient.signatureMethod === "typed" ? recipient.signatureName : "captured-signature"
      : field.type === "initials"
        ? initials(recipient.signatureName)
        : field.type === "date"
          ? recipient.signedAt.toISOString().slice(0, 10)
          : field.type === "checkbox"
            ? recipient.fieldValues[field.id] === true ? "X" : ""
            : String(recipient.fieldValues[field.id] ?? "");
    if (field.required && !value) throw new Error("native_esign_required_field_missing");
    if (!value) continue;
    const boxHeight = field.height * height;
    const boxWidth = field.width * width;
    if (field.type === "signature" && recipient.signatureMethod !== "typed") {
      const capture = captureByRecipient.get(recipient.id);
      if (!capture) throw new Error("native_esign_capture_artifact_missing");
      const scale = Math.min(boxWidth / capture.width, boxHeight / capture.height);
      const drawWidth = capture.width * scale;
      const drawHeight = capture.height * scale;
      page.drawImage(capture, {
        x: field.x * width + Math.max(0, (boxWidth - drawWidth) / 2),
        y: height - ((field.y + field.height) * height) + Math.max(0, (boxHeight - drawHeight) / 2),
        width: drawWidth,
        height: drawHeight,
      });
      continue;
    }
    const fontSize = Math.max(7, Math.min(field.type === "signature" ? 18 : 12, boxHeight * 0.62));
    page.drawText(value.slice(0, 1_000), {
      x: field.x * width,
      y: height - ((field.y + field.height) * height) + Math.max(1, (boxHeight - fontSize) / 2),
      size: fontSize,
      font: field.type === "signature" ? signatureFont : regular,
      color: rgb(0.08, 0.08, 0.14),
      maxWidth: field.width * width,
      lineHeight: fontSize * 1.1,
    });
  }

  const certificatePageCount = Math.max(1, Math.ceil(input.recipients.length / CERTIFICATE_RECIPIENTS_PER_PAGE));
  for (let pageIndex = 0; pageIndex < certificatePageCount; pageIndex += 1) {
    const certificate = document.addPage([612, 792]);
    const pageRecipients = input.recipients.slice(
      pageIndex * CERTIFICATE_RECIPIENTS_PER_PAGE,
      (pageIndex + 1) * CERTIFICATE_RECIPIENTS_PER_PAGE,
    );
    certificate.drawText("EntrepreneurOS Electronic Signature Record", { x: 54, y: 730, size: 18, font: regular });
    certificate.drawText(`Certificate page ${pageIndex + 1} of ${certificatePageCount} | Signers ${input.recipients.length}`, { x: 54, y: 712, size: 8, font: regular });
    certificate.drawText(`Envelope: ${input.envelopeId}`, { x: 54, y: 690, size: 9, font: regular });
    certificate.drawText(`Source SHA-256: ${input.sourceSha256}`, { x: 54, y: 674, size: 8, font: regular });
    certificate.drawText(`Completed: ${input.completedAt.toISOString()}`, { x: 54, y: 658, size: 9, font: regular });
    certificate.drawText("This record documents electronic consent and signing actions. It does not claim government-ID verification or a qualified certificate signature.", {
      x: 54, y: 628, size: 9, font: regular, maxWidth: 504, lineHeight: 12,
    });
    let y = 578;
    for (const recipient of pageRecipients) {
      certificate.drawText(`${recipient.signerName} <${recipient.signerEmail}>`, { x: 54, y, size: 11, font: regular, maxWidth: 504 });
      certificate.drawText(`Role: ${recipient.roleKey} | Method: ${recipient.signatureMethod} | Signed: ${recipient.signedAt.toISOString()}`, { x: 54, y: y - 16, size: 8, font: regular, maxWidth: 504 });
      certificate.drawText(`Consent: ${recipient.consentVersion} | Signature evidence SHA-256: ${recipient.signatureSha256}`, { x: 54, y: y - 30, size: 7, font: regular, maxWidth: 504 });
      certificate.drawText(`Capture SHA-256: ${recipient.signatureCaptureSha256}${recipient.signatureCaptureMimeType ? ` | ${recipient.signatureCaptureMimeType} ${recipient.signatureCaptureWidth}x${recipient.signatureCaptureHeight}` : " | canonical typed capture"}`, { x: 54, y: y - 44, size: 7, font: regular, maxWidth: 504 });
      y -= 74;
    }
    certificate.drawText(`EOS native e-sign evidence certificate | ${pageIndex + 1}/${certificatePageCount}`, { x: 54, y: 34, size: 7, font: regular, color: rgb(0.35, 0.35, 0.42) });
  }
  document.setTitle(`Signed envelope ${input.envelopeId}`);
  document.setAuthor("EntrepreneurOS");
  document.setCreator("EntrepreneurOS native e-sign");
  document.setProducer("EntrepreneurOS native e-sign using pdf-lib");
  document.setModificationDate(input.completedAt);
  return Buffer.from(await document.save({ useObjectStreams: true, addDefaultPage: false }));
}
