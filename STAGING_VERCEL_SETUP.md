# Staging Setup For QA And Client Review

This project should use a permanent staging branch and a separate staging database.

## Target Setup

- Production branch: `main`
- Staging branch: `staging`
- Production domain: your existing live domain
- Staging domain: `staging.your-domain.com` or `qa.your-domain.com`
- Database: separate Neon/Postgres database for staging only

## Why Separate Staging DB

- QA billing, returns, stock changes, and finance entries must not pollute production data.
- Client review should be safe even if they click destructive actions.
- You can reset staging data without touching live operations.

## Branch Workflow

1. Push feature fixes to `staging` first.
2. QA tests on the staging URL.
3. Client reviews on the same staging URL.
4. After approval, merge `staging` into `main`.
5. Production deploys from `main`.

## Vercel Setup Steps

### 1. Create the permanent staging deployment

In Vercel:

1. Open your project.
2. Go to `Settings` -> `Git`.
3. Confirm this repository is connected.
4. Ensure branch deployments are enabled.
5. Keep `main` as production.
6. Use `staging` as the branch for the permanent QA deployment.

If your Vercel project does not support a permanent branch domain automatically, create one from the `Domains` section after the first `staging` deployment appears.

### 2. Add staging domain

In Vercel:

1. Go to `Settings` -> `Domains`.
2. Add `staging.your-domain.com` or `qa.your-domain.com`.
3. Assign it to the latest deployment from branch `staging`.
4. Update DNS as Vercel instructs.

### 3. Add staging environment variables

In Vercel:

1. Go to `Settings` -> `Environment Variables`.
2. Add these values for the `Preview` environment, or for the branch-specific staging deployment if you use custom environments:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `PRISMA_ENABLE_LEGACY_MIDDLEWARE` = `false`

Use [env.staging.example](env.staging.example) as the template.

Set:

- `DATABASE_URL` to the staging database connection string
- `NEXTAUTH_SECRET` to a new random secret for staging
- `NEXTAUTH_URL` to the exact staging URL, for example `https://staging.your-domain.com`

## Neon / Postgres Setup Steps

### Option A: Recommended

Create a completely separate staging database/project in Neon.

### Option B: Acceptable

Create a separate database inside the same Neon project, if you cannot create a second project yet.

Do not point staging at the production database.

## Initialize The Staging Database

After you create the staging DB, run schema setup against the staging `DATABASE_URL`.

Use one of these methods.

### Method 1: Local terminal against staging DB

1. Set local env vars to the staging values.
2. Run:

```powershell
npx prisma generate
npx prisma migrate deploy
```

### Method 2: Neon SQL + seed file

If you need seed data after schema setup, run:

```powershell
psql "YOUR_STAGING_DATABASE_URL" -f scripts/001_initial_seed.sql
```

## Create Test Login For QA And Client

After seeding, verify that at least one admin user exists.

If needed, use the existing admin reset endpoint on staging only:

- `POST /api/auth/reset-admin-password`

This resets admin passwords to `admin123` in the current code. Change that password immediately after first login.

Do not use this endpoint on production.

## Suggested Staging Safety Rules

- Only share staging credentials, never production credentials.
- Label staging clearly when sending the URL.
- Treat staging data as disposable.
- Avoid connecting staging printers to live hardware.
- Use staging for WhatsApp flow review only if you are comfortable with real link generation.

## QA Share Packet

Send your QA person only:

1. Staging URL
2. Username
3. Password
4. Simple test checklist

Suggested message:

```text
QA Testing Link:
https://staging.your-domain.com

Login:
User: ______
Password: ______

Please test:
1. Billing flow
2. Edit / delete / return bill
3. Bills page filters
4. Reports
5. Cash register
6. Inventory actions

If you find an issue, send:
1. Page name
2. What you clicked
3. What happened
4. Screenshot/video
```

## Client Share Packet

Suggested message:

```text
Review Link:
https://staging.your-domain.com

Login:
User: ______
Password: ______

This is the latest review build.
Please review the billing flow, reports, inventory, and admin sections.
Share any feedback in one message thread so we can track changes clearly.
```

## Release Flow

1. Fix issues on `staging`.
2. Re-test on staging URL.
3. Merge `staging` into `main`.
4. Verify production deployment.

## Important Security Note

This repository currently contains real-looking connection strings and auth secrets in local/readme files. Those should be rotated and removed from tracked documentation before wider team access.
