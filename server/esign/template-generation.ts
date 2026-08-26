import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { NativeEsignField, NativeEsignTemplateRecipient, NativeEsignTemplateVariable } from "@shared/native-esign";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export function nativeContractContentSha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

export function renderNativeContractText(input: {
  titleTemplate: string;
  bodyTemplate: string;
  variableSchema: NativeEsignTemplateVariable[];
  values: Record<string, string>;
  clauses: Array<{ clauseKey: string; versionId: string; bodyText: string; bodySha256: string }>;
}): { title: string; body: string; snapshot: Record<string, unknown> } {
  const allowed = new Set(input.variableSchema.map((variable) => variable.key));
  const unknown = Object.keys(input.values).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`native_esign_template_unknown_variable:${unknown.join(",")}`);
  for (const variable of input.variableSchema) {
    const value = (input.values[variable.key] || "").trim();
    if (variable.required && !value) throw new Error(`native_esign_template_variable_required:${variable.key}`);
    if (value.length > variable.maxLength) throw new Error(`native_esign_template_variable_too_long:${variable.key}`);
  }
  const clauseMap = new Map(input.clauses.map((clause) => [clause.clauseKey, clause]));
  const replace = (source: string) => source.replace(/\{\{\s*([a-z0-9._-]+)\s*\}\}/gi, (_match, key: string) => {
    if (key.startsWith("clause.")) {
      const clause = clauseMap.get(key.slice(7));
      if (!clause) throw new Error(`native_esign_template_clause_unresolved:${key.slice(7)}`);
      return clause.bodyText;
    }
    if (!allowed.has(key)) throw new Error(`native_esign_template_variable_unresolved:${key}`);
    return (input.values[key] || "").trim();
  });
  const title = replace(input.titleTemplate);
  const body = replace(input.bodyTemplate);
  return {
    title,
    body,
    snapshot: {
      values: Object.fromEntries(input.variableSchema.map((variable) => [variable.key, (input.values[variable.key] || "").trim()])),
      clauses: input.clauses.map(({ clauseKey, versionId, bodySha256 }) => ({ clauseKey, versionId, bodySha256 })),
      renderedSha256: nativeContractContentSha256({ title, body }),
    },
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function renderNativeContractPdf(input: {
  title: string;
  body: string;
  recipients: NativeEsignTemplateRecipient[];
  generationReference: string;
}): Promise<{ pdf: Buffer; fields: NativeEsignField[]; pageCount: number }> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 54;
  let page: PDFPage = document.addPage(pageSize);
  let y = 730;
  page.drawText(input.title, { x: margin, y, size: 18, font: bold, maxWidth: 504, color: rgb(0.08, 0.08, 0.14) });
  y -= 40;
  for (const line of wrapText(input.body, regular, 10.5, 504)) {
    if (y < 62) { page = document.addPage(pageSize); y = 730; }
    if (line) page.drawText(line, { x: margin, y, size: 10.5, font: regular, maxWidth: 504, color: rgb(0.1, 0.1, 0.16) });
    y -= line ? 15 : 9;
  }

  const signaturePage = document.addPage(pageSize);
  const signaturePageNumber = document.getPageCount();
  signaturePage.drawText("Signature page", { x: margin, y: 730, size: 18, font: bold });
  signaturePage.drawText("The signature fields below are part of the generated document and are completed through EOS native signing.", { x: margin, y: 706, size: 9, font: regular, maxWidth: 504 });
  const fields: NativeEsignField[] = [];
  let rowY = 640;
  for (const recipient of input.recipients) {
    if (rowY < 110) throw new Error("native_esign_template_recipient_layout_exceeded");
    signaturePage.drawText(recipient.label, { x: margin, y: rowY + 24, size: 10, font: bold });
    signaturePage.drawRectangle({ x: margin, y: rowY - 2, width: 330, height: 36, borderWidth: 0.7, borderColor: rgb(0.55, 0.55, 0.62) });
    signaturePage.drawRectangle({ x: 402, y: rowY - 2, width: 156, height: 36, borderWidth: 0.7, borderColor: rgb(0.55, 0.55, 0.62) });
    fields.push({ id: randomUUID(), roleKey: recipient.roleKey, type: "signature", page: signaturePageNumber, x: margin / 612, y: (792 - (rowY + 34)) / 792, width: 330 / 612, height: 36 / 792, label: `${recipient.label} signature`, required: true });
    fields.push({ id: randomUUID(), roleKey: recipient.roleKey, type: "date", page: signaturePageNumber, x: 402 / 612, y: (792 - (rowY + 34)) / 792, width: 156 / 612, height: 36 / 792, label: `${recipient.label} date`, required: true });
    rowY -= 92;
  }
  signaturePage.drawText(`Generation reference: ${input.generationReference}`, { x: margin, y: 48, size: 7, font: regular, color: rgb(0.4, 0.4, 0.46) });
  document.setTitle(input.title);
  document.setAuthor("EntrepreneurOS");
  document.setCreator("EntrepreneurOS governed contract templates");
  document.setProducer("EntrepreneurOS native e-sign using pdf-lib");
  return { pdf: Buffer.from(await document.save({ useObjectStreams: true })), fields, pageCount: document.getPageCount() };
}
