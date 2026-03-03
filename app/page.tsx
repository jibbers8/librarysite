import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ReservationView = {
  id: string;
  subject: string;
  resourceName: string | null;
  reservationKind: string;
  startsAt: Date | null;
  endsAt: Date | null;
  holdUntil: Date | null;
  pickupLocation: string | null;
};

function formatDate(value: Date | null) {
  if (!value) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function Home() {
  const reservations: ReservationView[] = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      OR: [{ holdUntil: null }, { holdUntil: { gte: new Date() } }],
    },
    orderBy: [{ holdUntil: "asc" }, { startsAt: "asc" }, { receivedAt: "desc" }],
    take: 100,
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Current Library Reservations</h1>
          <p className="text-sm text-zinc-600">
            Auto-synced from Outlook confirmation emails.
          </p>
        </div>
        <a className="text-sm underline" href="/owner">
          Owner Console
        </a>
      </div>

      {reservations.length === 0 ? (
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
    </main>
  );
}
