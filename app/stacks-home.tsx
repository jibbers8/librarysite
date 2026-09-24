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

function spineLabelLines(reservation: ReservationView) {
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
  return ["Date", "not set yet"];
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
  const [labelDay, labelTime] = spineLabelLines(reservation);

  const width = 84 + seeded(reservation.id, 1) * 16;
  const style = {
    "--book-w": `${width}%`,
    "--book-x": `${seeded(reservation.id, 2) * (100 - width)}%`,
    "--book-h": `${Math.round(70 + seeded(reservation.id, 3) * 22)}px`,
    "--book-tilt": `${(seeded(reservation.id, 4) - 0.5) * 0.8}deg`,
    "--book-delay": `${Math.min(total - 1 - index, 10) * 85}ms`,
  } as CSSProperties;

  const placeLine = [place ?? reservation.pickupLocation, live && reservation.endsAt ? `in use until ${formatClock(reservation.endsAt)}` : null]
    .filter(Boolean)
    .join(", ");

  return (
    <li className="stx-book" data-kind={reservation.reservationKind.toLowerCase()} data-live={live || undefined} style={style}>
      <details>
        <summary className="stx-spine">
          <span aria-hidden className="stx-spine__tooling" />
          <span className="stx-spine__title">
            <span className="stx-spine__name">{title}</span>
            {placeLine && <span className="stx-spine__place">{placeLine}</span>}
          </span>
          <span className="stx-label">
            <span className="stx-label__kind">{kindName}</span>
            <span>{labelDay}</span>
            <span>{labelTime}</span>
          </span>
          {live && <span aria-hidden className="stx-ribbon" />}
        </summary>

        <div className="stx-slip">
          <dl>
            <div>
              <dt>Starts</dt>
              <dd>{formatShort(reservation.startsAt)}</dd>
            </div>
            <div>
              <dt>Ends</dt>
              <dd>{formatShort(reservation.endsAt)}</dd>
            </div>
            {reservation.holdUntil && (
              <div>
                <dt>Hold until</dt>
                <dd>{formatShort(reservation.holdUntil)}</dd>
              </div>
            )}
            <div>
              <dt>Where</dt>
              <dd>{reservation.pickupLocation || place || "Not listed in the email"}</dd>
            </div>
            <div className="stx-slip__wide">
              <dt>From the email</dt>
              <dd>{reservation.subject}</dd>
            </div>
          </dl>
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
  const syncText = autoSyncHealthy
    ? "Auto-sync is working."
    : autoSyncNeedsRefresh
      ? "Auto-sync is refreshing now."
      : "Auto-sync needs a look from the owner.";

  return (
    <div className="stx">
      <main className="stx-page">
        <header className="stx-head">
          <h1 className="stx-head__title">On reserve</h1>
          <div className="stx-head__side">
            <p className="stx-head__lede">
              Library rooms and holds that are booked right now, pulled from reservation emails.
            </p>
            {!loadError && (
              <p className="stx-sync" data-state={syncState}>
                <span aria-hidden className="stx-sync__lamp" />
                <span>
                  {syncText}{" "}
                  {latestAutoSync
                    ? `Last ran ${formatDay(new Date(latestAutoSync.startedAt))} at ${formatClock(new Date(latestAutoSync.startedAt))}.`
                    : "It hasn’t run yet."}
                </span>
              </p>
            )}
            <StacksRoomFinder />
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
            <>
              <p className="stx-shelf__hint">
                {reservations.length === 1 ? "One reservation." : `${reservations.length} reservations, soonest on top.`} Open a book for the details.
              </p>
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
            </>
          )}
          <div aria-hidden className="stx-table" />
        </section>

        <footer className="stx-foot">
          <p>Times shown in Tucson time.</p>
          <ThemeToggle className="stx-link" current="stacks" />
        </footer>
      </main>
    </div>
  );
}
