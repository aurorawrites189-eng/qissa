# Limitations — read before trusting this project

Blunt list of what was **not** done, not tested, or is intentionally
narrow. This file exists so nobody mistakes "builds cleanly" for
"production-ready".

## Never executed against a live database

- Migrations `0001_schema.sql`, `0002_social.sql`,
  `0003_service_role_insert_defaults.sql`, plus `storage.sql` and
  `seed.sql`, were hand-reviewed only. **They have never run against a
  real Postgres instance.** The first `supabase db push` must be watched
  statement-by-statement; expect at least minor fixes (e.g. extension
  availability for `pg_trgm`, function-signature drift between 0001 and
  0002).
- `scripts/seed.mjs` has never run either — no live Supabase project was
  available. Its logic is straightforward, but auth-admin behavior
  (e.g. `listUsers` pagination beyond 50 users) is untested here.

## Auth & email

- Email verification and password-reset **delivery** depend on Supabase's
  email provider and free-tier sending limits. The flows are wired, but
  deliverability (spam folder, rate caps) is unverified. Use a custom SMTP
  provider before launch.

## Originality checking is internal-DB-only

- `lib/originality` compares a post **only against stories already
  published in Qissa's own database** (same language). It does **not**
  scan the public internet. Real web-wide plagiarism detection needs a
  paid API (Copyscape, Turnitin, etc.). All user-facing copy says
  "compared with stories published on Qissa" — never claim more.
- The check runs **synchronously** inside
  `POST /api/internal/originality-check`. On Cloudflare Workers this
  risks CPU-time limits on long corpora; move it to a queue/cron worker
  that calls `runOriginalityCheck()` directly before real traffic.

## Metrics & abuse

- **View counts can be inflated.** `POST /api/posts/[id]/views` has no
  dedup — refreshes and bots count. Treat as rough popularity, not
  analytics (documented in `docs/PHASE3_NOTES.md`).
- **Rate limiting is in-memory** (`lib/rate-limit.ts`). On serverless/edge
  runtimes each isolate has its own counter, so limits barely hold.
  Needs Redis/Upstash for production.

## Age-gating is UX-only

- `middleware.ts` redirects child sessions to age-appropriate areas, but
  middleware is bypassable by design. **RLS is the actual enforcer**
  (child sessions can only read kids-approved posts). Never rely on the
  middleware for safety guarantees.
- Kids' reporting and reading-history depend on the middleware API
  allowlist (`/api/kids/*`, `POST /api/reports`,
  `GET /api/notifications`). If the allowlist drifts out of sync with the
  routes, those features silently break for children — the kids reader
  currently falls back to a direct Supabase upsert for history, but the
  report button via API does not have that fallback.

## Missing product surface (tables/RLS exist, UI does not)

- **Block/unblock UI.** `blocks` table + RLS + feed/search exclusion are
  done; users cannot manage blocks yet.
- No public author profile pages, no email notifications, no sitemap
  entries for individual posts (see the hook comment in `app/sitemap.ts`),
  no RSS.

## i18n

- Only `en` and `ur` ship. Urdu translations were written by the build
  team, not a professional translator — expect awkward phrasing a native
  speaker should review.
- The dictionary split (`en.json` + `en.social.json`) is a known wart;
  see the reconciliation note in `lib/i18n/get-dictionary.ts`.

## Build environment

- `npm run build` passes in this container (Node 24, Linux). The
  Cloudflare Pages adapter (`@cloudflare/next-on-pages`) has **not**
  been installed or tested — edge-runtime behavior of the middleware and
  route handlers is unverified. See `docs/DEPLOYMENT.md`.
