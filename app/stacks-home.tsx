import type { CSSProperties } from "react";

import { StacksRoomFinder } from "@/app/stacks-room-finder";
import { ThemeToggle } from "@/app/theme-toggle";
import {
  formatClock,
  formatClockRange,
  formatDay,
  formatMonthDay,
  formatShort,
  isInProgress,
  isSameTucsonDay,
  splitResourceName,
  type HomeViewProps,
  type ReservationView,
} from "@/lib/reservationView";

const KIND_NAMES: Record<string, string> = {
  ROOM: "Room",
  BOOK: "Book",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

/** Small stable hash so each book keeps its size and offset between visits. */
function seeded(id: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** Returns the spine label as [small line, big line]. */
function spineLabelLines(reservation: ReservationView): [string, string] {
  const { startsAt, endsAt } = reservation;
  // Step back 1ms so a booking that ends at midnight still counts as one day.
  if (startsAt && endsAt && !isSameTucsonDay(startsAt, new Date(endsAt.getTime() - 1))) {
    return [`${formatMonthDay(startsAt)} to ${formatMonthDay(endsAt)}`, `from ${formatClock(startsAt)}`];
  }
  if (startsAt) {
    return [formatDay(startsAt), formatClockRange(startsAt, endsAt)];
  }
  if (reservation.holdUntil) {
    return ["Pick up by", formatDay(reservation.holdUntil)];
  }
  return ["Date", "Not set yet"];
}

function slipRows(reservation: ReservationView, place: string | null) {
  const rows: Array<[string, string]> = [];
  if (reservation.startsAt) {
    rows.push(["Starts", formatShort(reservation.startsAt)]);
  }
  if (reservation.endsAt) {
    rows.push(["Ends", formatShort(reservation.endsAt)]);
  }
  if (reservation.holdUntil) {
    rows.push(["Hold until", formatShort(reservation.holdUntil)]);
  }
  if (!reservation.startsAt && !reservation.endsAt && !reservation.holdUntil) {
    rows.push(["When", "Not in the email"]);
  }
  rows.push(["Where", reservation.pickupLocation || place || "Not in the email"]);
  return rows;
}

function Book({
  reservation,
  index,
  total,
  now,
}: {
  reservation: ReservationView;
  index: number;
  total: number;
  now: Date;
}) {
  const { title, place } = splitResourceName(reservation.resourceName || reservation.subject);
  const kindName = KIND_NAMES[reservation.reservationKind] ?? "Other";
  const live = isInProgress(reservation, now);
  const ended = !!reservation.endsAt && reservation.endsAt.getTime() <= now.getTime();
  const [labelSmall, labelBig] =
    live && reservation.endsAt
      ? ["In use now", `until ${formatClock(reservation.endsAt)}`]
      : spineLabelLines(reservation);

  const width = 84 + seeded(reservation.id, 1) * 16;
  const style = {
    "--book-w": `${width}%`,
    "--book-x": `${seeded(reservation.id, 2) * (100 - width)}%`,
    "--book-h": `${Math.round(70 + seeded(reservation.id, 3) * 22)}px`,
    "--book-tilt": `${(seeded(reservation.id, 4) - 0.5) * 0.8}deg`,
    "--book-delay": `${Math.min(total - 1 - index, 10) * 85}ms`,
  } as CSSProperties;

  const placeLine = place ?? reservation.pickupLocation;

  return (
    <li
      className="stx-book"
      data-kind={reservation.reservationKind.toLowerCase()}
      data-ended={ended || undefined}
      data-live={live || undefined}
      style={style}
    >
      <details>
        <summary className="stx-spine">
          <span aria-hidden className="stx-spine__tooling" />
          <span className="stx-spine__title">
            <span className="stx-spine__name" data-length={title.length > 30 ? "long" : title.length > 14 ? "medium" : undefined}>
              {title}
            </span>
            {placeLine && <span className="stx-spine__place">{placeLine}</span>}
          </span>
          <span className="stx-label">
            <span className="stx-label__small">{labelSmall}</span>
            {ended && reservation.endsAt ? (
              <span className="stx-stamp">Ended {formatClock(reservation.endsAt)}</span>
            ) : (
              <span className="stx-label__big">{labelBig}</span>
            )}
            <span className="stx-label__kind">{kindName}</span>
          </span>
          {live && <span aria-hidden className="stx-ribbon" />}
        </summary>

        <div className="stx-slip">
          <table>
            <tbody>
              {slipRows(reservation, place).map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </li>
  );
}

export function StacksHome({
  reservations,
  loadError,
  latestAutoSync,
  autoSyncHealthy,
  autoSyncNeedsRefresh,
}: HomeViewProps) {
  const now = new Date();
  const syncState = autoSyncHealthy ? "ok" : autoSyncNeedsRefresh ? "refreshing" : "attention";
  const lastRun = latestAutoSync ? new Date(latestAutoSync.startedAt) : null;
  const lastRunText = lastRun
    ? isSameTucsonDay(lastRun, now)
      ? formatClock(lastRun)
      : `${formatDay(lastRun)}, ${formatClock(lastRun)}`
    : null;
  const syncText = autoSyncHealthy
    ? `Synced at ${lastRunText}`
    : autoSyncNeedsRefresh
      ? "Syncing now"
      : lastRunText
        ? `Last synced ${lastRunText}`
        : "Not synced yet";
  const syncTitle = autoSyncHealthy
    ? "Auto-sync is working."
    : autoSyncNeedsRefresh
      ? "The last auto-sync is stale, so a fresh one is running."
      : "Auto-sync needs a look from the owner.";

  return (
    <div className="stx">
      <main className="stx-page">
        <header className="stx-head">
          <h1 className="stx-head__title">On reserve</h1>
          <div className="stx-head__side">
            <p className="stx-head__lede">
              Library rooms and holds that are booked right now, pulled from reservation emails. Open
              any book for the details.
            </p>
            <div className="stx-head__actions">
              <StacksRoomFinder />
              {!loadError && (
                <p className="stx-sync" data-state={syncState} title={syncTitle}>
                  <span aria-hidden className="stx-sync__lamp" />
                  <span>{syncText}</span>
                </p>
              )}
            </div>
          </div>
        </header>

        <section aria-label="Current reservations" className="stx-shelf">
          {loadError ? (
            <div className="stx-empty">
              <p className="stx-empty__title">The stack can&rsquo;t load yet.</p>
              <p>Reservations aren&rsquo;t available until environment setup is finished and the site is redeployed.</p>
            </div>
          ) : reservations.length === 0 ? (
            <div className="stx-empty">
              <p className="stx-empty__title">Nothing on reserve right now.</p>
              <p>New room bookings and holds show up here after the next sync.</p>
            </div>
          ) : (
            <ol className="stx-books">
              {reservations.map((reservation, index) => (
                <Book
                  index={index}
                  key={reservation.id}
                  now={now}
                  reservation={reservation}
                  total={reservations.length}
                />
              ))}
            </ol>
          )}
        </section>
      </main>

      <div aria-hidden className="stx-table" />

      <div className="stx-under">
        <footer className="stx-foot">
          <p>Times are Tucson time. Bookings drop off the stack 8 hours after they end.</p>
          <ThemeToggle className="stx-link" current="stacks" />
        </footer>
      </div>
    </div>
  );
}
