import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { syncReservations } from "@/lib/syncReservations";
import { SignInButton } from "@/app/owner/sign-in-button";

export const dynamic = "force-dynamic";

type OwnerPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

async function triggerSync() {
  "use server";
  const session = await getServerAuthSession();
  const sessionEmail = session?.user?.email?.toLowerCase();
  if (!sessionEmail) {
    redirect("/owner?syncError=not-signed-in");
  }

  try {
    await syncReservations({ ownerEmailOverride: sessionEmail, trigger: "MANUAL" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 220) : "sync-failed";
    console.error("Owner sync failed:", error);
    redirect(`/owner?syncError=${encodeURIComponent(message)}`);
  }

  redirect("/owner");
}

export default async function OwnerPage({ searchParams }: OwnerPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const authError =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const syncError =
    typeof resolvedSearchParams.syncError === "string"
      ? resolvedSearchParams.syncError
      : undefined;
  const session = await getServerAuthSession();
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const isOwner = session?.user?.email?.toLowerCase() === ownerEmail;

  const latestSync = isOwner
    ? await prisma.syncLog.findFirst({
        orderBy: { startedAt: "desc" },
      })
    : null;
  const latestAutoSync = isOwner
    ? await prisma.syncLog.findFirst({
        where: {
          trigger: "CRON",
        },
        orderBy: { startedAt: "desc" },
      })
    : null;
  const autoSyncHealthy = latestAutoSync?.status === "SUCCESS";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">Owner Console</h1>
      <p className="text-sm text-zinc-600">
        Sign in with your Google account to sync forwarded reservation emails.
      </p>

      {authError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Google sign-in failed (`error={authError}`). Check Google OAuth redirect
          URIs, Google client ID/secret env vars, and `NEXTAUTH_SECRET` in Vercel.
        </div>
      )}
      {syncError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Sync failed: <code>{syncError}</code>
        </div>
      )}

      {!session && (
        <SignInButton />
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
          <div
            className={`rounded-md border p-3 text-sm ${
              autoSyncHealthy
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            Auto-sync status:{" "}
            <span className="font-medium">
              {autoSyncHealthy ? "Healthy" : "Needs attention"}
            </span>
            {latestAutoSync ? (
              <> (last auto-sync {new Date(latestAutoSync.startedAt).toLocaleString()})</>
            ) : (
              <> (no auto-sync runs recorded yet)</>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
