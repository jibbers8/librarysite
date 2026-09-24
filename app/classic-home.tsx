import { LibCalSearchTool } from "@/app/libcal-search-tool";
import { ThemeToggle } from "@/app/theme-toggle";
import {
  formatDate,
  formatTucsonTime,
  type HomeViewProps,
  type ReservationView,
} from "@/lib/reservationView";

export function ClassicHome({
  reservations,
  loadError,
  latestAutoSync,
  autoSyncHealthy,
  autoSyncLabel,
}: HomeViewProps) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Current Library Reservations</h1>
          <p className="text-sm text-zinc-600">
            Auto-synced from forwarded Gmail reservation emails.
          </p>
        </div>
        <LibCalSearchTool />
      </div>
      {!loadError && (
        <div
          className={`mb-4 rounded-md border p-3 text-sm ${
            autoSyncHealthy
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          Auto-sync: <span className="font-medium">{autoSyncLabel}</span>
          {latestAutoSync ? (
            <> (last auto-sync {formatTucsonTime(new Date(latestAutoSync.startedAt))})</>
          ) : (
            <> (no auto-sync runs yet)</>
          )}
        </div>
      )}

      {loadError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-800">
          Reservations are not available yet. Finish environment setup and redeploy.
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm text-zinc-600">
          No active reservations found.
        </div>
      ) : (
        <ul className="grid gap-4">
          {reservations.map((reservation: ReservationView) => (
            <li className="rounded-lg border p-4" key={reservation.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {reservation.resourceName || reservation.subject}
                </h2>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium uppercase">
                  {reservation.reservationKind}
                </span>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-zinc-700">
                <p>
                  <span className="font-medium">Start:</span>{" "}
                  {formatDate(reservation.startsAt)}
                </p>
                <p>
                  <span className="font-medium">End:</span>{" "}
                  {formatDate(reservation.endsAt)}
                </p>
                <p>
                  <span className="font-medium">Hold until:</span>{" "}
                  {formatDate(reservation.holdUntil)}
                </p>
                <p>
                  <span className="font-medium">Location:</span>{" "}
                  {reservation.pickupLocation || "Not provided"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 text-right">
        <ThemeToggle
          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800"
          current="classic"
        />
      </div>
    </main>
  );
}
