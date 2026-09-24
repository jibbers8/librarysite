export type ReservationView = {
  id: string;
  subject: string;
  resourceName: string | null;
  reservationKind: string;
  startsAt: Date | null;
  endsAt: Date | null;
  holdUntil: Date | null;
  pickupLocation: string | null;
};

export type AutoSyncStatus = {
  startedAt: Date;
  status: "RUNNING" | "SUCCESS" | "FAILURE";
};

export type HomeViewProps = {
  reservations: ReservationView[];
  loadError: boolean;
  latestAutoSync: AutoSyncStatus | null;
  autoSyncHealthy: boolean;
  autoSyncNeedsRefresh: boolean;
  autoSyncLabel: string;
};

const TIME_ZONE = "America/Phoenix";

export function formatDate(value: Date | null) {
  if (!value) {
    return "TBD";
  }

  return formatTucsonTime(value);
}

export function formatTucsonTime(value: Date) {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(value)} Tucson`;
}

function part(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: TIME_ZONE }).format(value);
}

/** "Wed, Sep 24" */
export function formatDay(value: Date) {
  return part(value, { weekday: "short", month: "short", day: "numeric" });
}

/** "5:00 pm" */
export function formatClock(value: Date) {
  return part(value, { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

/** "5:00–9:00 pm", or "11:00 am–1:00 pm" when the range crosses noon. */
export function formatClockRange(start: Date, end: Date | null) {
  const startText = formatClock(start);
  if (!end) {
    return startText;
  }
  const endText = formatClock(end);
  const startSuffix = startText.slice(-2);
  const endSuffix = endText.slice(-2);
  const startTrimmed = startSuffix === endSuffix ? startText.slice(0, -3) : startText;
  return `${startTrimmed}–${endText}`;
}

/** "Sep 24" */
export function formatMonthDay(value: Date) {
  return part(value, { month: "short", day: "numeric" });
}

export function isSameTucsonDay(a: Date, b: Date) {
  return formatMonthDay(a) === formatMonthDay(b) && part(a, { year: "numeric" }) === part(b, { year: "numeric" });
}

/** "Sep 24, 5:00 pm" */
export function formatShort(value: Date | null) {
  if (!value) {
    return "Not set";
  }
  return `${part(value, { month: "short", day: "numeric" })}, ${formatClock(value)}`;
}

/**
 * LibCal rooms arrive as "B539 - Main Library". Split the room code from the
 * building so the code can be stamped large on the spine.
 */
export function splitResourceName(name: string) {
  const match = name.match(/^\s*([A-Za-z]?\d{1,4}[A-Za-z]?)\s*[-–]\s*(.+)$/);
  if (!match) {
    return { title: name.trim(), place: null as string | null };
  }
  return { title: match[1].toUpperCase(), place: match[2].trim() };
}

export function isInProgress(reservation: ReservationView, now = new Date()) {
  const { startsAt, endsAt } = reservation;
  if (!startsAt || !endsAt) {
    return false;
  }
  const time = now.getTime();
  return startsAt.getTime() <= time && time < endsAt.getTime();
}
