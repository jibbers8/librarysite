# Library Reservations Site

Public website for friends to see your current library reservations, synced from forwarded reservation emails in Gmail.

## Stack

- Next.js (App Router + TypeScript)
- NextAuth with Google OAuth
- Prisma + PostgreSQL
- Gmail API (`gmail.readonly`)

## Local Setup

1. Run automated setup:
   - `npm run setup`
2. Open `.env.local` and fill only values that must come from your accounts:
   - `DATABASE_URL`
   - `OWNER_EMAIL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. If you changed `DATABASE_URL`, run:
   - `npm run prisma:push`
4. Start:
   - `npm run dev`

Visit:
- `http://localhost:3000` for the public reservations page
- `http://localhost:3000/owner` for owner sign-in and manual sync

## Google App Registration

Create OAuth credentials in Google Cloud:

- Enable the Gmail API for your project.
- Create an OAuth Web Client.
- Redirect URI:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://<your-vercel-domain>/api/auth/callback/google`
- OAuth scopes:
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/gmail.readonly`

Then place client ID and client secret in environment variables.

Helper command (prints exact callback URLs for your current env/domain):
- `npm run callbacks`

## Sync Behavior

- Manual sync: owner can trigger from `/owner`.
- Scheduled sync: GitHub Actions runs hourly and calls `/api/cron/sync`.
- Backup sync: Vercel Cron runs daily (`vercel.json`) to satisfy Hobby plan limits.
- Public page only displays normalized reservation metadata from the database.
- Automatic cleanup runs after sync:
  - reservations are removed 24 hours after `endsAt`/`holdUntil`
  - old `SyncLog` rows are pruned (default 48 hours)
  - configure sync log retention via `SYNC_LOG_RETENTION_HOURS`

### GitHub Scheduled Sync Setup

Add these repository secrets in GitHub (`Settings` -> `Secrets and variables` -> `Actions`):

- `SYNC_URL`: `https://<your-vercel-domain>/api/cron/sync`
- `CRON_SECRET`: same value as the `CRON_SECRET` environment variable in Vercel

The workflow file is `.github/workflows/sync-reservations.yml`.

## Deploying on Vercel

1. Import this project into Vercel.
2. Set all environment variables from `.env.local` or `.env.example`.
3. Ensure the database is reachable from Vercel.
4. Deploy and sign in once at `/owner` to authorize Gmail access.

## GitHub First Workflow

1. Push this project to GitHub.
2. CI runs automatically via `.github/workflows/ci.yml` (lint + build).
3. Connect the GitHub repo to Vercel.
4. Add the same env vars in Vercel Project Settings.
5. Add Google production callback URL using your Vercel domain.
