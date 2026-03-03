# Library Reservations Site

Public website for friends to see your current library reservations, synced from Outlook confirmation emails.

## Stack

- Next.js (App Router + TypeScript)
- NextAuth with Microsoft OAuth
- Prisma + PostgreSQL
- Microsoft Graph API (`Mail.Read`)

## Local Setup

1. Run automated setup:
   - `npm run setup`
2. Open `.env.local` and fill only values that must come from your accounts:
   - `DATABASE_URL`
   - `OWNER_EMAIL`
   - `MICROSOFT_CLIENT_ID`
   - `MICROSOFT_CLIENT_SECRET`
3. If you changed `DATABASE_URL`, run:
   - `npm run prisma:push`
4. Start:
   - `npm run dev`

Visit:
- `http://localhost:3000` for the public reservations page
- `http://localhost:3000/owner` for owner sign-in and manual sync

## Microsoft App Registration

Create an app registration in Azure/Microsoft Entra:

- Supported account type: your account type (personal + org if needed)
- Redirect URI:
  - `http://localhost:3000/api/auth/callback/azure-ad`
  - `https://<your-vercel-domain>/api/auth/callback/azure-ad`
- API permissions (delegated):
  - `openid`
  - `profile`
  - `email`
  - `offline_access`
  - `User.Read`
  - `Mail.Read`

Then place client ID, client secret, and tenant ID in environment variables.

Helper command (prints exact callback URLs for your current env/domain):
- `npm run callbacks`

## Sync Behavior

- Manual sync: owner can trigger from `/owner`.
- Scheduled sync: GitHub Actions runs hourly and calls `/api/cron/sync`.
- Backup sync: Vercel Cron runs daily (`vercel.json`) to satisfy Hobby plan limits.
- Public page only displays normalized reservation metadata from the database.

### GitHub Scheduled Sync Setup

Add these repository secrets in GitHub (`Settings` -> `Secrets and variables` -> `Actions`):

- `SYNC_URL`: `https://<your-vercel-domain>/api/cron/sync`
- `CRON_SECRET`: same value as the `CRON_SECRET` environment variable in Vercel

The workflow file is `.github/workflows/sync-reservations.yml`.

## Deploying on Vercel

1. Import this project into Vercel.
2. Set all environment variables from `.env.local` or `.env.example`.
3. Ensure the database is reachable from Vercel.
4. Deploy and sign in once at `/owner` to authorize Outlook access.

## GitHub First Workflow

1. Push this project to GitHub.
2. CI runs automatically via `.github/workflows/ci.yml` (lint + build).
3. Connect the GitHub repo to Vercel.
4. Add the same env vars in Vercel Project Settings.
5. Add Microsoft production callback URL using your Vercel domain.
