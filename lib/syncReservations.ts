import { prisma } from "@/lib/db";
import { fetchRecentMessages } from "@/lib/mailClient";
import { isPotentialReservationEmail, parseReservationEmail } from "@/lib/emailParser";

export type SyncTrigger = "MANUAL" | "CRON" | "API";

type SyncResult = {
  emailsRead: number;
  parsedCount: number;
  upsertedCount: number;
  skippedCount: number;
  deletedReservationCount: number;
  deletedSyncLogCount: number;
};

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

async function refreshGoogleToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth environment variables.");
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token refresh failed: ${response.status} ${text}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function getOwnerGoogleAccount(ownerEmailOverride?: string) {
  const ownerEmail = ownerEmailOverride?.toLowerCase() ?? process.env.OWNER_EMAIL?.toLowerCase();
  if (!ownerEmail) {
    throw new Error("Sign in to an owner account or set OWNER_EMAIL.");
  }

  const user = await prisma.user.findUnique({
    where: { email: ownerEmail },
    include: {
      accounts: {
        where: { provider: "google" },
        orderBy: { id: "desc" },
        take: 1,
      },
    },
  });

  const account = user?.accounts[0];
  if (!account) {
    throw new Error("No Google account found. Sign in at /owner first.");
  }

  return account;
}

async function getValidAccessToken(ownerEmailOverride?: string) {
  const account = await getOwnerGoogleAccount(ownerEmailOverride);

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresSoon = !account.expires_at || account.expires_at < nowInSeconds + 60;

  if (!expiresSoon && account.access_token) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error("Missing refresh token. Sign in again to re-authorize access.");
  }

  const refreshed = await refreshGoogleToken(account.refresh_token);
  const expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? account.refresh_token,
      expires_at: expiresAt,
      scope: refreshed.scope ?? account.scope,
      token_type: refreshed.token_type ?? account.token_type,
    },
  });

  return refreshed.access_token;
}

function getRetentionDays() {
  const reservationDays = Number.parseInt(
    process.env.RESERVATION_RETENTION_DAYS ?? "180",
    10
  );
  const syncLogDays = Number.parseInt(process.env.SYNC_LOG_RETENTION_DAYS ?? "60", 10);

  return {
    reservationDays:
      Number.isNaN(reservationDays) || reservationDays < 7 ? 180 : reservationDays,
    syncLogDays: Number.isNaN(syncLogDays) || syncLogDays < 7 ? 60 : syncLogDays,
  };
}

async function cleanupOldData() {
  const { reservationDays, syncLogDays } = getRetentionDays();

  const reservationCutoff = new Date(
    Date.now() - reservationDays * 24 * 60 * 60 * 1000
  );
  const syncLogCutoff = new Date(Date.now() - syncLogDays * 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.deleteMany({
    where: {
      syncedAt: { lt: reservationCutoff },
      OR: [
        { status: "CANCELED" },
        { status: "EXPIRED" },
        { holdUntil: { lt: reservationCutoff } },
        { endsAt: { lt: reservationCutoff } },
      ],
    },
  });

  const syncLogs = await prisma.syncLog.deleteMany({
    where: {
      startedAt: { lt: syncLogCutoff },
    },
  });

  return {
    deletedReservationCount: reservations.count,
    deletedSyncLogCount: syncLogs.count,
  };
}

type SyncOptions = {
  ownerEmailOverride?: string;
  trigger?: SyncTrigger;
};

export async function syncReservations(options: SyncOptions = {}) {
  const { ownerEmailOverride, trigger = "MANUAL" } = options;
  const syncLog = await prisma.syncLog.create({
    data: {
      trigger,
    },
  });

  try {
    const accessToken = await getValidAccessToken(ownerEmailOverride);
    const messages = await fetchRecentMessages(accessToken, 75);

    let parsedCount = 0;
    let upsertedCount = 0;
    let skippedCount = 0;

    for (const message of messages) {
      if (!isPotentialReservationEmail(message)) {
        skippedCount += 1;
        continue;
      }

      parsedCount += 1;
      const parsed = parseReservationEmail(message);

      await prisma.reservation.upsert({
        where: { messageId: message.id },
        create: {
          messageId: message.id,
          internetMessageId: message.internetMessageId,
          subject: message.subject ?? "(no subject)",
          senderEmail: message.from?.emailAddress?.address,
          reservationKind: parsed.reservationKind,
          resourceName: parsed.resourceName,
          pickupLocation: parsed.pickupLocation,
          startsAt: parsed.startsAt,
          endsAt: parsed.endsAt,
          holdUntil: parsed.holdUntil,
          status: parsed.status,
          cancellationUrl: parsed.cancellationUrl,
          sourceWebLink: message.webLink,
          rawPreview: parsed.rawPreview,
          receivedAt: new Date(message.receivedDateTime),
        },
        update: {
          internetMessageId: message.internetMessageId,
          subject: message.subject ?? "(no subject)",
          senderEmail: message.from?.emailAddress?.address,
          reservationKind: parsed.reservationKind,
          resourceName: parsed.resourceName,
          pickupLocation: parsed.pickupLocation,
          startsAt: parsed.startsAt,
          endsAt: parsed.endsAt,
          holdUntil: parsed.holdUntil,
          status: parsed.status,
          cancellationUrl: parsed.cancellationUrl,
          sourceWebLink: message.webLink,
          rawPreview: parsed.rawPreview,
          receivedAt: new Date(message.receivedDateTime),
          syncedAt: new Date(),
        },
      });

      upsertedCount += 1;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        emailsRead: messages.length,
        parsedCount,
        upsertedCount,
        skippedCount,
      },
    });

    const cleanupResult = await cleanupOldData();

    return {
      emailsRead: messages.length,
      parsedCount,
      upsertedCount,
      skippedCount,
      deletedReservationCount: cleanupResult.deletedReservationCount,
      deletedSyncLogCount: cleanupResult.deletedSyncLogCount,
    } satisfies SyncResult;
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        finishedAt: new Date(),
        status: "FAILURE",
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
    });

    throw error;
  }
}
