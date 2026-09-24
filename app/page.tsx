import { after } from "next/server";

import { prisma } from "@/lib/db";
import { reservationExpiryCutoff } from "@/lib/reservationExpiry";
import { syncReservations } from "@/lib/syncReservations";
import { ClassicHome } from "@/app/classic-home";
import { StacksHome } from "@/app/stacks-home";
import type { AutoSyncStatus, HomeViewProps, ReservationView } from "@/lib/reservationView";
import { getTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

const AUTO_SYNC_STALE_MS = 75 * 60 * 1000;
const AUTO_SYNC_RUNNING_GRACE_MS = 10 * 60 * 1000;

function shouldQueueAutoSync(latestAutoSync: AutoSyncStatus | null) {
  if (!latestAutoSync) {
    return true;
  }

  const ageMs = Date.now() - latestAutoSync.startedAt.getTime();
  if (latestAutoSync.status === "RUNNING" && ageMs < AUTO_SYNC_RUNNING_GRACE_MS) {
    return false;
  }

  return ageMs > AUTO_SYNC_STALE_MS;
}

function queueStaleAutoSync(latestAutoSync: AutoSyncStatus | null) {
  if (!shouldQueueAutoSync(latestAutoSync)) {
    return;
  }

  after(async () => {
    try {
      await syncReservations({ trigger: "CRON" });
    } catch (error) {
      console.error("Background stale auto-sync failed", error);
    }
  });
}

export default async function Home() {
  let reservations: ReservationView[] = [];
  let latestAutoSync: AutoSyncStatus | null = null;
  let loadError = false;

  try {
    reservations = await prisma.reservation.findMany({
      where: {
        status: "CONFIRMED",
        AND: [
          { OR: [{ holdUntil: null }, { holdUntil: { gte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: reservationExpiryCutoff() } }] },
        ],
      },
      orderBy: [{ holdUntil: "asc" }, { startsAt: "asc" }, { receivedAt: "desc" }],
      take: 100,
    });
    latestAutoSync = await prisma.syncLog.findFirst({
      where: { trigger: "CRON" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, status: true },
    });
    queueStaleAutoSync(latestAutoSync);
  } catch {
    loadError = true;
  }
  const autoSyncNeedsRefresh = !loadError && shouldQueueAutoSync(latestAutoSync);
  const autoSyncHealthy =
    latestAutoSync?.status === "SUCCESS" && !autoSyncNeedsRefresh;
  const autoSyncLabel = autoSyncHealthy
    ? "Working"
    : autoSyncNeedsRefresh
      ? "Refreshing"
      : "Check owner console";

  const theme = await getTheme();
  const viewProps: HomeViewProps = {
    reservations,
    loadError,
    latestAutoSync,
    autoSyncHealthy,
    autoSyncNeedsRefresh,
    autoSyncLabel,
  };

  return theme === "classic" ? <ClassicHome {...viewProps} /> : <StacksHome {...viewProps} />;
}
