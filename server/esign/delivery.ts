function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function nativeEsignDeliveryEmail(input: {
  signerName: string;
  companyName: string;
  documentTitle: string;
  envelopeSubject: string;
  envelopeMessage: string;
  signingUrl: string;
  expiresAt: Date;
}): { subject: string; body: string } {
  const subject = input.envelopeSubject.replace(/[\r\n]+/g, " ").trim();
  const message = input.envelopeMessage
    ? `<p style="margin:0 0 20px;color:#4b5563">${escapeHtml(input.envelopeMessage)}</p>`
    : "";
  return {
    subject,
    body: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171717">
      <p>Hello ${escapeHtml(input.signerName)},</p>
      <p><strong>${escapeHtml(input.companyName)}</strong> has asked you to review and sign <strong>${escapeHtml(input.documentTitle)}</strong>.</p>
      ${message}
      <p><a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#6d39d8;color:#fff;text-decoration:none;font-weight:600">Review and sign</a></p>
      <p style="margin-top:24px;font-size:13px;color:#6b7280">This private link expires ${escapeHtml(input.expiresAt.toISOString())}. Do not forward it. If you were not expecting this request, contact the sender without opening the link.</p>
      <p style="font-size:12px;color:#6b7280">Sent through EntrepreneurOS native electronic signing.</p>
    </div>`,
  };
}

export function classifyNativeEsignDeliveryFailure(error: unknown): {
  state: "failed" | "uncertain";
  code: string;
  safeMessage: string;
} {
  const message = error instanceof Error ? error.message : "Provider delivery failed.";
  if (/not connected|connect gmail|token expired|no refresh token|not configured/i.test(message))
    return { state: "failed", code: "gmail_authorization_unavailable", safeMessage: "The operator Gmail connection is unavailable." };
  if (/invalid line break/i.test(message))
    return { state: "failed", code: "gmail_message_invalid", safeMessage: "The signing message contains an invalid mail header." };
  return { state: "uncertain", code: "gmail_delivery_uncertain", safeMessage: "Gmail did not return a definitive delivery receipt." };
}

export function nativeEsignCompletionEmail(input: {
  signerName: string;
  companyName: string;
  documentTitle: string;
  completedAt: Date;
  completedDocumentUrl: string;
  receiptUrl: string;
  finalSha256: string;
}): { subject: string; body: string } {
  return {
    subject: `Completed: ${input.documentTitle}`,
    body: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171717">
      <p>Hello ${escapeHtml(input.signerName)},</p>
      <p>All required signatures for <strong>${escapeHtml(input.documentTitle)}</strong> are complete.</p>
      <p><a href="${escapeHtml(input.completedDocumentUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#6d39d8;color:#fff;text-decoration:none;font-weight:600">Download signed document</a></p>
      <p><a href="${escapeHtml(input.receiptUrl)}">View completion receipt</a></p>
      <p style="font-size:13px;color:#6b7280">Completed ${escapeHtml(input.completedAt.toISOString())} by ${escapeHtml(input.companyName)}.</p>
      <p style="font-size:12px;color:#6b7280">Final SHA-256: ${escapeHtml(input.finalSha256)}</p>
    </div>`,
  };
}

export function nativeContractNoticeEmail(input: {
  recipientName: string;
  companyName: string;
  subject: string;
  bodyText: string;
  noticeType: string;
  contentSha256: string;
}): { subject: string; body: string } {
  return {
    subject: input.subject.replace(/[\r\n]+/g, " ").trim(),
    body: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#171717">
      <p>Hello ${escapeHtml(input.recipientName)},</p>
      <div style="white-space:pre-wrap;line-height:1.55">${escapeHtml(input.bodyText)}</div>
      <hr style="margin:28px 0;border:0;border-top:1px solid #e5e7eb"/>
      <p style="font-size:13px;color:#6b7280">This ${escapeHtml(input.noticeType.replaceAll("_", " "))} notice was sent by ${escapeHtml(input.companyName)} through an approval-bound EntrepreneurOS contract workflow.</p>
      <p style="font-size:12px;color:#6b7280">Approved content SHA-256: ${escapeHtml(input.contentSha256)}</p>
    </div>`,
  };
}
