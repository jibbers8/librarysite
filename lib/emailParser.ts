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

type ParsedCalendarEvent = {
  resourceName?: string;
  pickupLocation?: string;
  startsAt?: Date;
  endsAt?: Date;
};

function extractText(message: MailMessage) {
  const body = message.body?.content ?? "";

  if (message.body?.contentType === "html") {
    return htmlToText(body, { wordwrap: false, selectors: [{ selector: "a", options: { ignoreHref: true } }] });
  }

  return body || message.bodyPreview || "";
}

function normalizeReservationText(text: string) {
  // Undo quoted-printable line wrapping artifacts commonly seen in forwarded emails.
  const unwrapped = text.replace(/=\r?\n/g, "");
  // Decode "=XX" sequences where XX is hex.
  const decoded = unwrapped.replace(/=([A-Fa-f0-9]{2})/g, (_, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
  return decoded.replace(/\s+/g, " ").trim();
}

function parseDateTime(dateText: string, timeText: string) {
  const direct = new Date(`${dateText} ${timeText}`);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  // Fallback for formats that include weekday prefix before the real date.
  const withoutWeekday = dateText.replace(/^[A-Za-z]+,\s*/, "");
  const fallback = new Date(`${withoutWeekday} ${timeText}`);
  return Number.isNaN(fallback.getTime()) ? undefined : fallback;
}

function parseIcsDate(value: string) {
  const trimmed = value.trim();
  const zMatch = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
  );
  if (zMatch) {
    const [, y, m, d, hh, mm, ss] = zMatch;
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
  }

  const localMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss);
  }

  return undefined;
}

function parseCalendarEvent(ics?: string): ParsedCalendarEvent {
  if (!ics) {
    return {};
  }

  const startMatch = ics.match(/DTSTART(?:;[^:\n]+)?:([^\r\n]+)/i);
  const endMatch = ics.match(/DTEND(?:;[^:\n]+)?:([^\r\n]+)/i);
  const summaryMatch = ics.match(/SUMMARY:([^\r\n]+)/i);
  const locationMatch = ics.match(/LOCATION:([^\r\n]+)/i);

  const startsAt = startMatch ? parseIcsDate(startMatch[1]) : undefined;
  const endsAt = endMatch ? parseIcsDate(endMatch[1]) : undefined;
  const summary = summaryMatch?.[1]?.trim();
  const location = locationMatch?.[1]?.trim();

  let resourceName: string | undefined;
  if (summary) {
    const bookingMatch = summary.match(/Booking:\s*(.+?)(?:\s*-\s*[^-]+@[^-]+)?$/i);
    resourceName = bookingMatch?.[1]?.trim() || summary;
  }

  return {
    resourceName,
    pickupLocation: location,
    startsAt,
    endsAt,
  };
}

function parseReservationWindow(text: string) {
  const compact = normalizeReservationText(text);
  const patterns = [
    // Exact format from forwarded reservation lines:
    // B539 - Main Library: 5:00pm - 9:00pm, Wednesday, March 18, 2026
    /([A-Za-z0-9][A-Za-z0-9\s\-&/]+):\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m)\s*[-–]\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m),\s*([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    /reservation is confirmed for:\s*([^:]+):\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m)\s*[-–]\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m),\s*([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
    /(?:for:\s*)?([A-Za-z0-9][A-Za-z0-9\s\-&/]+):\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m)\s*[-–]\s*([0-9]{1,2}(?::[0-9]{2})?\s*[ap]m),\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
  ];

  let match: RegExpMatchArray | null = null;
  for (const pattern of patterns) {
    match = compact.match(pattern);
    if (match) {
      break;
    }
  }

  if (!match) {
    return {};
  }

  const [, resourceName, startText, endText, dateText] = match;
  const start = parseDateTime(dateText, startText);
  const end = parseDateTime(dateText, endText);

  return {
    resourceName: resourceName.trim(),
    startsAt: start,
    endsAt: end,
  };
}

function parseHoldUntil(text: string) {
  const compact = normalizeReservationText(text);
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
  const text = normalizeReservationText(extractText(message));
  const reservationWindow = parseReservationWindow(text);
  const calendarEvent = parseCalendarEvent(message.calendarIcs);
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
    resourceName: reservationWindow.resourceName ?? calendarEvent.resourceName,
    pickupLocation: pickupLocation ?? calendarEvent.pickupLocation,
    startsAt: reservationWindow.startsAt ?? calendarEvent.startsAt,
    endsAt: reservationWindow.endsAt ?? calendarEvent.endsAt,
    holdUntil,
    status,
    cancellationUrl: cancellationUrlMatch?.[0],
    rawPreview: (message.bodyPreview || text).slice(0, 1000),
  };
}
