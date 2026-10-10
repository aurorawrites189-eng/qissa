# Deployment — GitHub → Supabase → Cloudflare Pages

**Production:** https://qissa-37g.pages.dev (Cloudflare Pages project `qissa`;
`qissa.pages.dev` is owned by someone else, so Cloudflare assigned `qissa-37g`).

Target: a **free-tier** deployment. Nothing below has been run end-to-end
against live services (see `docs/LIMITATIONS.md`); treat this as a
checklist, not a verified runbook.

## 1. Push to GitHub

```bash
cd qissa-platform
git init
git add -A
git commit -m "Qissa initial commit"
git branch -M main
git remote add origin https://github.com/<you>/qissa.git
git push -u origin main
```

Make sure `.env.local` is git-ignored (it contains the service-role key).
`.env.example` is the template other developers copy.

## 2. Supabase project (free tier)

1. Create a project at supabase.com (free tier is enough to start).
2. Note the project ref, the anon key, and the **service-role key**
   (Project Settings → API). The service-role key bypasses RLS — it lives
   **only** in server env vars, never in client code.
3. Apply the database, in this order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_social.sql`
   - `supabase/migrations/0003_service_role_insert_defaults.sql`
   - `supabase/storage.sql` (buckets: `post-images`, `avatars`)
   - `supabase/seed.sql` (14 categories; safe to re-run)

   Via CLI: `supabase link --project-ref <ref>` then `supabase db push`
   (pushes `supabase/migrations/` in filename order), then
   `psql <connection-string> -f supabase/storage.sql -f supabase/seed.sql`.
   Via dashboard: run each file in the SQL editor in the same order.
4. (Optional) Run `node scripts/seed.mjs` locally against the hosted
   project to get demo users + sample stories. Delete the demo users or
   rotate their passwords before launch.
5. **Free-plan limits:** Supabase's free tier has caps (database size,
   monthly active users, storage, email sends, etc.) that change over
   time — **verify the current limits on supabase.com/pricing before
   relying on them**, and set up usage alerts in the dashboard.

## 3. Cloudflare Pages via `@cloudflare/next-on-pages`

Next.js on Cloudflare Pages needs the `@cloudflare/next-on-pages`
adapter (Pages does not run a Node server; the adapter builds a
Workers-compatible bundle).

```bash
npm install --save-dev @cloudflare/next-on-pages
```

Adapt the build:

```jsonc
// package.json scripts
{
  "pages:build": "npx @cloudflare/next-on-pages"
}
```

In the Cloudflare dashboard (Workers & Pages → Create → Pages →
Connect to Git → select the repo):

- **Build command:** `npx @cloudflare/next-on-pages`
- **Build output directory:** `.vercel/output/static` (this is what the
  adapter produces — yes, the `.vercel` path is correct for this tool)
- **Environment variables** (both Production and Preview):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (mark as secret/encrypted)
  - `NEXT_PUBLIC_SITE_URL` = your Pages URL, e.g.
    `https://qissa.pages.dev` (used for sitemap/robots and auth redirects)
  - `INTERNAL_API_SECRET` (optional but recommended — required as
    `x-internal-secret` by `/api/internal/originality-check` when set)

After the first deploy, update `NEXT_PUBLIC_SITE_URL` to the real
deployed URL and redeploy so sitemap.xml/robots.txt advertise the
canonical domain.

### Middleware on Pages

`middleware.ts` runs on Cloudflare's edge runtime via the adapter.
It uses `@supabase/ssr` cookie handling only — no Node-only APIs —
but **verify the age-gating redirects and the child API allowlist work
on the deployed URL**; edge-runtime quirks are exactly the kind of thing
that passes `next build` and fails in production.

### Known adapter constraints (check current docs)

- `next-on-pages` supports a subset of Next.js features; ISR, some
  `next/image` optimizations, and long-running route handlers behave
  differently on Workers. If the build warns about an unsupported
  feature, address it before launch.
- **Free-plan limits:** Cloudflare's free tier has caps (requests/day,
  Workers CPU time, KV/storage if you add it) — **verify current limits
  on cloudflare.com/plans before relying on them.**

## 4. Post-deploy smoke tests

- `/` → redirects to `/en`; `/ur` renders RTL.
- Sign up as adult → write → submit for review → (admin) approve →
  story appears in `/feed`.
- Sign up as a child (birth year < 18 years ago) → lands in `/kids`;
  direct navigation to `/en/dashboard` or `/en/write` redirects back.
- As a child, open a kids story → reading history records (this exercises
  the middleware API allowlist: `POST /en/api/kids/history`).
- Admin moderation queue approves/rejects; strike → suspension flow.

## 5. Ongoing

- Backups: enable Supabase's point-in-time / daily backups per your plan.
- Logs: watch the Pages deployment logs and Supabase Auth logs for the
  first weeks.
- Rate limiting is currently in-memory (`lib/rate-limit.ts`) — fine for
  a single instance, but move to Redis/Upstash before any multi-instance
  or high-traffic setup.

**Free branded URL:** https://nazmhub.pages.dev (Cloudflare Pages project `nazmhub`, created 2026-10-10; same repo, same env vars, SITE_URL points at nazmhub.pages.dev).
