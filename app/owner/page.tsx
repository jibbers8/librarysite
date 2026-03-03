import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { syncReservations } from "@/lib/syncReservations";

export const dynamic = "force-dynamic";

async function triggerSync() {
  "use server";
  const session = await getServerAuthSession();
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const sessionEmail = session?.user?.email?.toLowerCase();
  const isOwner = Boolean(ownerEmail && sessionEmail && ownerEmail === sessionEmail);
  if (!isOwner) {
    throw new Error("Only the owner can run a sync.");
  }

  await syncReservations();

  redirect("/owner");
}

export default async function OwnerPage() {
  const session = await getServerAuthSession();
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const isOwner = session?.user?.email?.toLowerCase() === ownerEmail;

  const latestSync = isOwner
    ? await prisma.syncLog.findFirst({
        orderBy: { startedAt: "desc" },
      })
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">Owner Console</h1>
      <p className="text-sm text-zinc-600">
        Sign in with your Google account to sync forwarded reservation emails.
      </p>

      {!session && (
        <Link
          className="inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          href="/api/auth/signin/google?callbackUrl=/owner"
        >
          Sign in with Google
        </Link>
      )}

      {session && !isOwner && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm">
          Signed in as {session.user?.email}, but `OWNER_EMAIL` is different. Update
          your environment variables or sign in with the owner account.
        </div>
      )}

      {session && isOwner && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <p className="text-sm">
            Signed in as <span className="font-medium">{session.user?.email}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={triggerSync}>
              <button
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
                type="submit"
              >
                Run Sync Now
              </button>
            </form>

            <Link
              className="rounded-md border px-4 py-2 text-sm font-medium"
              href="/api/auth/signout?callbackUrl=/owner"
            >
              Sign out
            </Link>
          </div>

          {latestSync && (
            <div className="text-sm text-zinc-600">
              Latest sync: {latestSync.status} at{" "}
              {new Date(latestSync.startedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
