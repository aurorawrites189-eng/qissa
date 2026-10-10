# Qissa (قصہ) — a multilingual writing community

Qissa is a bilingual (Urdu + English) platform where people write, publish,
and read stories, essays, and poetry — with a dedicated, age-gated
**Kids' Story World** for young readers.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth + Storage) · zod validation.

> Status: pre-launch. The schema migrations have been hand-reviewed but
> **never executed against a live Postgres database** — the first
> `supabase db push` must be watched closely. See `docs/LIMITATIONS.md`
> for a blunt list of what is and isn't verified.

## Prerequisites

- Node.js 18+ (20+ recommended) and npm
- A Supabase project — either a free hosted project at supabase.com, or
  local via the [Supabase CLI](https://supabase.com/docs/guides/cli)
  (`supabase init` / `supabase start`)
- `psql` (only needed to apply `supabase/seed.sql`)

## Local setup

```bash
# 1. Clone and install
git clone <your-repo-url> qissa-platform
cd qissa-platform
npm install

# 2. Point the project at your Supabase project
#    Option A — hosted project:  supabase link --project-ref <ref>
#    Option B — local:            supabase start   (then use its credentials)
supabase link --project-ref <your-project-ref>

# 3. Apply migrations IN ORDER, then the category seed data.
#    Watch the first push closely — these migrations have never run
#    against a live database (see docs/LIMITATIONS.md).
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
#    (DATABASE_URL = your project's Postgres connection string;
#     for local: supabase db reset applies migrations; then run seed.sql via psql.)

# 4. Environment
cp .env.example .env.local
#    Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#    SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Project Settings → API),
#    and NEXT_PUBLIC_SITE_URL (http://localhost:3000 for local dev).

# 5. Optional: demo content (2 demo users + 6 original sample stories)
node scripts/seed.mjs

# 6. Run it
npm run dev
#    → http://localhost:3000  (redirects to /en)
```

### What `scripts/seed.mjs` does

- Creates `demo.author@qissa.example` (adult) and `demo.kid@qissa.example`
  (child) via `auth.admin.createUser`, with matching `profiles` rows.
- Inserts the six original stories from `lib/seed/stories.ts` as published
  posts (kids' stories get `is_kids_approved = true`).
- Idempotent: skips users/posts that already exist (matched by email and
  by author + title).
- Demo password for both accounts: `QissaDemo123!` — change it or delete the
  demo users before going live.

## Project structure

```
app/
  [lang]/                 # locale-prefixed routes (en | ur), RTL for Urdu
    page.tsx              # landing
    feed/                 # public story feed with filters
    kids/                 # Kids' Story World (age-gated by middleware)
    kids/story/[id]/      # large-type kids reader
    posts/[id]/           # full reader (likes, comments, save, report)
    write/                # adult-only editor (draft → review → publish)
    dashboard/            # adult profile, stories, notifications, strikes
    admin/                # moderation queues, users, appeals, audit log
    api/                  # 13 JSON API routes (see docs/PHASE2_NOTES.md,
                          # docs/PHASE3_NOTES.md for the endpoint table)
  sitemap.ts / robots.ts  # SEO basics
components/               # UI: cards, buttons, reader widgets, admin tables
lib/
  i18n/                   # dictionaries (en/ur + en.social/ur.social),
                          # get-dictionary.ts (deep-merge), types.ts
  originality/            # internal-DB plagiarism check (NOT web-wide)
  supabase/               # browser / server / middleware clients
  seed/stories.ts         # original demo content (typed)
  strikes.ts, validation.ts, rate-limit.ts, storage.ts, ...
supabase/
  migrations/0001_schema.sql   # all tables + RLS (child read-only on kids posts)
  migrations/0002_social.sql   # blocks, trigram search, service_role guard fix
  migrations/0003_service_role_insert_defaults.sql  # insert-side guard fix
  seed.sql                # 14 categories (idempotent)
  storage.sql             # post-images + avatars buckets
scripts/seed.mjs          # demo users + sample stories
docs/                     # phase notes, deployment, security, limitations, SEO
middleware.ts             # session refresh + child age-gating with an
                          # explicit API allowlist (/api/kids/*, POST /api/reports,
                          # GET /api/notifications)
```

## i18n — adding a language

1. Copy `lib/i18n/dictionaries/en.json` → `<code>.json` and
   `en.social.json` → `<code>.social.json`; translate every string
   (key trees must be identical — `tsc` enforces the type parity).
2. Add the locale to `SITE.locales` in `lib/site-config.ts` and to
   `SUPPORTED_LOCALES` in `lib/i18n/config.ts` (set RTL in
   `localeDirections` if needed).
3. Add the `<code>.social.json` entry to the `SOCIAL` map in
   `lib/i18n/get-dictionary.ts`.
4. `npx tsc --noEmit` must pass; the `Dictionary` type catches missing keys
   at compile time.

## Key docs

- `docs/DEPLOYMENT.md` — GitHub → Supabase → Cloudflare Pages walkthrough
- `docs/SECURITY.md` — security checklist
- `docs/LIMITATIONS.md` — what is unverified / intentionally out of scope
- `docs/SEO.md` — realistic SEO strategy
- `docs/PHASE2_NOTES.md`, `docs/PHASE3_NOTES.md` — build notes per phase

## Scripts

| Command           | What it does                        |
|-------------------|-------------------------------------|
| `npm run dev`     | local dev server                    |
| `npm run build`   | production build (must pass clean)  |
| `npm start`       | serve the production build          |
| `npx tsc --noEmit`| type-check                          |
| `node scripts/seed.mjs` | seed demo users + stories      |

## 🌐 Live Site

**NazmHub** is live at https://qissa-37g.pages.dev — a bilingual (Urdu + English) writing and storytelling community.
