import type { gmail_v1 } from 'googleapis';

export interface PdfAttachment {
  attachmentId: string;
  filename: string;
}

export function getHeader(
  message: gmail_v1.Schema$Message,
  name: string,
): string | null {
  const header = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return header?.value ?? null;
}

export function extractSenderEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim();
}

export function extractSenderName(fromHeader: string): string | null {
  const match = fromHeader.match(/^"?([^"<]+)"?\s*<[^>]+>/);
  return match ? match[1].trim() : null;
}

export function extractPlainTextBody(message: gmail_v1.Schema$Message): string {
  const part = findPart(message.payload, (p) => p.mimeType === 'text/plain');
  if (!part?.body?.data) {
    return '';
  }
  return Buffer.from(part.body.data, 'base64url').toString('utf-8');
}

export function findPdfAttachments(
  message: gmail_v1.Schema$Message,
): PdfAttachment[] {
  const attachments: PdfAttachment[] = [];
  collectParts(message.payload, (part) => {
    const filename = part.filename ?? '';
    const isPdf =
      part.mimeType === 'application/pdf' ||
      filename.toLowerCase().endsWith('.pdf');
    if (isPdf && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: filename || 'attachment.pdf',
      });
    }
  });
  return attachments;
}

function findPart(
  part: gmail_v1.Schema$MessagePart | undefined,
  predicate: (part: gmail_v1.Schema$MessagePart) => boolean,
): gmail_v1.Schema$MessagePart | undefined {
  if (!part) {
    return undefined;
  }
  if (predicate(part)) {
    return part;
  }
  for (const child of part.parts ?? []) {
    const found = findPart(child, predicate);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function collectParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  visit: (part: gmail_v1.Schema$MessagePart) => void,
): void {
  if (!part) {
    return;
  }
  visit(part);
  for (const child of part.parts ?? []) {
    collectParts(child, visit);
  }
}
