import { htmlToText } from "html-to-text";

import type { MailMessage } from "@/lib/mailClient";

const ALLOWED_SENDER_PATTERNS = [
  /@mail\.libcal\.com$/i,
  /@library\.arizona\.edu$/i,
];

const RESERVATION_SUBJECT_PATTERN =
  /(reservation|hold ready|room reservation|request|pickup|library)/i;

export type ParsedReservation = {
  reservationKind: "ROOM" | "BOOK" | "EQUIPMENT" | "OTHER";
  resourceName?: string;
  pickupLocation?: string;
  startsAt?: Date;
  endsAt?: Date;
  holdUntil?: Date;
  status: "CONFIRMED" | "CANCELED" | "EXPIRED";
  cancellationUrl?: string;
  rawPreview?: string;
};

function extractText(message: MailMessage) {
  const body = message.body?.content ?? "";

  if (message.body?.contentType === "html") {
    return htmlToText(body, { wordwrap: false, selectors: [{ selector: "a", options: { ignoreHref: true } }] });
  }

  return body || message.bodyPreview || "";
}

function parseReservationWindow(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();

  const match = compact.match(
    /reservation is confirmed for:\s*([^:]+):\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m)\s*-\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m),\s*([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i
  );

  if (!match) {
    return {};
  }

  const [, resourceName, startText, endText, dateText] = match;
  const start = new Date(`${dateText} ${startText}`);
  const end = new Date(`${dateText} ${endText}`);

  return {
    resourceName: resourceName.trim(),
    startsAt: Number.isNaN(start.getTime()) ? undefined : start,
    endsAt: Number.isNaN(end.getTime()) ? undefined : end,
  };
}

function parseHoldUntil(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  const match = compact.match(
    /(hold(?:ing)?(?: expires| until| by)?|pick(?:\s|-)?up by)\s*:?\s*([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*[ap]m)?)/i
  );

  if (!match) {
    return undefined;
  }

  const date = new Date(match[2]);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function detectReservationKind(subject: string, text: string): ParsedReservation["reservationKind"] {
  const content = `${subject} ${text}`.toLowerCase();

  if (content.includes("room")) {
    return "ROOM";
  }
  if (content.includes("equipment")) {
    return "EQUIPMENT";
  }
  if (content.includes("book") || content.includes("hold")) {
    return "BOOK";
  }

  return "OTHER";
}

export function isPotentialReservationEmail(message: MailMessage) {
  const sender = message.from?.emailAddress?.address ?? "";
  const subject = message.subject ?? "";

  const senderMatch = ALLOWED_SENDER_PATTERNS.some((pattern) => pattern.test(sender));
  const subjectMatch = RESERVATION_SUBJECT_PATTERN.test(subject);

  return senderMatch || subjectMatch;
}

export function parseReservationEmail(message: MailMessage): ParsedReservation {
  const text = extractText(message);
  const reservationWindow = parseReservationWindow(text);
  const lowerText = text.toLowerCase();

  const cancellationUrlMatch = text.match(/https?:\/\/\S*cancel\S*/i);

  let status: ParsedReservation["status"] = "CONFIRMED";
  if (/(canceled|cancelled|has been cancelled)/i.test(lowerText)) {
    status = "CANCELED";
  }

  const holdUntil = parseHoldUntil(text);
  if (holdUntil && holdUntil.getTime() < Date.now()) {
    status = "EXPIRED";
  }

  const locationMatch = text.match(/Directions for\s+([^:]+):/i);
  const pickupLocation = locationMatch?.[1]?.trim();

  return {
    reservationKind: detectReservationKind(message.subject ?? "", text),
    resourceName: reservationWindow.resourceName,
    pickupLocation,
    startsAt: reservationWindow.startsAt,
    endsAt: reservationWindow.endsAt,
    holdUntil,
    status,
    cancellationUrl: cancellationUrlMatch?.[0],
    rawPreview: (message.bodyPreview || text).slice(0, 1000),
  };
}
