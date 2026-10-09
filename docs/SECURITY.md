# Security checklist

Honest status of each control as of this writing. "Implemented" means the
code exists and type-checks/builds — **not** that it has been
penetration-tested or run against production traffic.

## Implemented

- [x] **RLS on all tables.** Every table has row-level security policies;
  child accounts can only read published, public, kids-approved posts
  (`can_view_post()`), and RLS is the real enforcement behind the
  middleware's UX-level age-gating.
- [x] **Service-role key is server-only.** It is used in route handlers and
  `lib/supabase/server.ts` only. Never imported in client components;
  never committed (`.env.local` is git-ignored, `.env.example` is empty).
- [x] **zod validation on write endpoints.** All 13 API routes validate
  request bodies with zod schemas (`lib/validation.ts`).
- [x] **File upload limits.** `POST /api/upload`: images only, ≤ 5 MB, to
  the `post-images` bucket; avatars ≤ 2 MB to `avatars`. MIME type is
  checked server-side (extension alone is not trusted).
- [x] **Password hashing by Supabase Auth.** Passwords never touch our code
  as plaintext beyond the signup/login form submit; hashing, salting, and
  session management are Supabase's.
- [x] **Admin guards are server-side.** Admin pages and `/api/admin/*`
  check `is_admin` via the service-role client on the server — never a
  client-side flag.
- [x] **Audit log.** Moderation actions write to `moderation_actions`
  (admin UI has an audit tab).
- [x] **Internal endpoint secret.** `/api/internal/originality-check`
  requires `x-internal-secret` matching `INTERNAL_API_SECRET` when the env
  var is set. **Set it in production** — without it the endpoint is
  callable by anyone who guesses the path.
- [x] **Guard triggers.** `protect_profile_fields` /
  `protect_post_moderation_fields` / `default_post_moderation_fields`
  prevent privilege escalation even if an API route has a bug; all three
  now exempt `service_role` (migrations 0002 + 0003) so server-side jobs
  keep working.
- [x] **No secrets in client bundles.** Only `NEXT_PUBLIC_*` vars are
  exposed to the browser (Supabase URL + anon key, site URL).

## Partial / needs work before handling real users

- [ ] **Rate limiting is in-memory** (`lib/rate-limit.ts`). Works on a
  single Node instance; on Cloudflare Workers/Pages (many isolates) each
  isolate gets its own counter, so limits are effectively per-isolate.
  Move to Redis/Upstash for any real deployment.
- [ ] **Input sanitization is framework-level only.** React escapes
  rendered strings by default, and content is stored as plain text (no
  HTML rendering), which removes the stored-XSS class. There is no
  additional sanitizer for profile fields/usernames — add one if you ever
  render user input outside React or allow markup.
- [ ] **CSRF.** Mutations go through `fetch` with same-origin cookies and
  no cross-site form posts are accepted; no CSRF tokens are implemented.
  Acceptable for a same-origin SPA, but reassess if you add cross-origin
  integrations.
- [ ] **Email verification delivery** depends on Supabase's email
  provider and free-tier sending limits — verify deliverability (SPF/DKIM
  via a custom SMTP provider) before launch; see `docs/LIMITATIONS.md`.
- [ ] **View counts are not abuse-proof** (`POST /api/posts/[id]/views`
  has no dedup — documented in PHASE3_NOTES.md).
- [ ] **No block/unblock UI** — the `blocks` table + RLS exist, feeds and
  search already exclude blocked authors, but users can't manage blocks
  yet.
- [ ] **Dependency hygiene.** Run `npm audit` before launch and keep
  Next.js/Supabase packages patched; no audit has been run in this build.

## Operational

- Rotate `SUPABASE_SERVICE_ROLE_KEY` if it ever appears in logs, error
  messages, or client bundles.
- Delete (or rotate passwords for) the `demo.*@qissa.example` seed users
  before launch.
- Set up Supabase usage alerts — a runaway script with the service key
  bypasses every RLS policy.
