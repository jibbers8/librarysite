import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { syncReservations } from "@/lib/syncReservations";

function isAuthorizedBySecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const incomingSecret = request.headers.get("x-sync-secret");
  return incomingSecret === secret;
}

export async function POST(request: Request) {
  const requestKey =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(`sync:${requestKey}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getServerAuthSession();
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const sessionEmail = session?.user?.email?.toLowerCase();

  const isOwner = Boolean(ownerEmail && sessionEmail && ownerEmail === sessionEmail);

  if (!isOwner && !isAuthorizedBySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncReservations();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown sync error",
      },
      { status: 500 }
    );
  }
}
