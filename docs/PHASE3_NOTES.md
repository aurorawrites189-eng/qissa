# Qissa — Phase 3 Notes (originality, moderation, social, admin)

## What was built

**Originality / plagiarism system** (`lib/originality/`)
- `normalize.ts` — lowercase → NFKD → strip combining diacritics (Latin
  accents + Arabic/Urdu harakat) → punctuation→space → collapse whitespace.
  Original text is always preserved separately; normalized text is never
  shown to users as if it were their writing.
- `fingerprint.ts` — 5-word shingles (`SHINGLE_SIZE`), FNV-1a hashed set.
- `compare.ts` — Jaccard similarity + verbatim shared-shingle samples
  ("exact matches") for evidence.
- `index.ts` — `runOriginalityCheck(postId)` (service-role client):
  compares against up to `ORIGINALITY_CORPUS_LIMIT` (2000) newest published
  posts in the same language; inserts an `originality_checks` row; updates
  `posts.originality_status` + `originality_evidence`.

### Originality thresholds (top-level constants in `lib/originality/index.ts` — documented tunable)

| Score (max Jaccard) | Status | Outcome |
|---|---|---|
| `< 0.15` | `low` | status → `published`, `published_at` set (never clobbered on re-run), author notified |
| `0.15 – 0.40` | `possible_duplication` | stays `pending_review` for human review; author notified with attribution guidance |
| `> 0.40` | `strong_evidence` | status → `withheld` + `recordViolation()` (type `plagiarism`), author notified |

### ⚠️ INTERNAL DATABASE ONLY — read before demoing
The checker compares a post **only against stories already published in
Qissa's own database** (same language). It does **not** check the public
internet. Web-wide plagiarism detection needs a paid API (Copyscape,
Turnitin, etc.) and a crawl/indexing budget. All user-facing copy
(notification templates, admin UI) says "compared with stories published
on Qissa" — never claim internet-wide checking.

**Production hardening still needed:** the check runs synchronously in
`POST /api/internal/originality-check`. Move it to a queue/cron worker
that calls `runOriginalityCheck()` directly, precompute per-post
fingerprints, and set `INTERNAL_API_SECRET` (the route requires it as
`x-internal-secret` when set).

## Strike policy (`lib/strikes.ts`)

- **Strikes follow ONLY confirmed violations — never an automated score
  alone.** `possible_duplication` never creates a violation; it only holds
  the post for human review. The single automated exception: `strong_evidence`
  (>0.40 Jaccard ≈ verbatim copying) is recorded as a confirmed `plagiarism`
  violation, and it is fully appealable.
- Strike 1–2 → warning notification (with appeal info). Strike 3 →
  `is_suspended=true`, `suspended_until = now + 30 days`, notified.
- `fileAppeal(violationId, userId, message)` — own confirmed violations only,
  one open appeal per violation.
- `decideAppeal(appealId, adminId, overturn)` — overturn: violation →
  `overturned`, `strike_count` decremented (floor 0), strike-driven
  suspension lifted, user notified.
- Tunables: `STRIKES_BEFORE_SUSPENSION = 3`, `STRIKE_SUSPENSION_DAYS = 30`.

## Endpoints (all under `app/[lang]/api/`)

| Method | Path | Notes |
|---|---|---|
| POST | `/internal/originality-check` | `{postId}`; optional `x-internal-secret`; sync — move to queue in prod |
| POST / GET | `/reports` | any signed-in user incl. kids; GET = own reports |
| POST / PATCH | `/appeals` | file (own violations) / admin decide `{appeal_id, overturn}` |
| GET / POST | `/admin/moderation` | queues `posts|reports|kids|originality`; actions `approve|reject|withhold|approve_kids` on posts, `dismiss|uphold` on reports; audit row + author notification |
| GET / POST | `/admin/users` | list/search; `suspend|unsuspend|make_admin|remove_admin` (no self-demotion) |
| POST / DELETE | `/posts/[id]/like` | adults only (explicit 403 for kids + RLS) |
| POST / DELETE | `/posts/[id]/save` | kids allowed (read-side personalization) |
| GET / POST | `/posts/[id]/comments` | POST adults only (403 for kids); notifies author |
| POST | `/posts/[id]/views` | fire-and-forget counter; **no dedup — refreshes/bots inflate it; treat as rough popularity, not analytics** |
| POST / DELETE | `/follow/[username]` | no self-follow; notifies followed user |
| GET | `/search` | `q, language, type=posts|authors`; posts via `search_posts()` trigram RPC |
| GET | `/feed/trending` | last 30 days, score = `view_count + like_count*10` (`LIKE_WEIGHT`) |
| GET / PATCH | `/notifications` | own; PATCH `{ids}` or `{markAll:true}` |

All write routes: zod-validated, rate-limited, explicit age/admin checks in
addition to RLS.

## Database (migration `0002_social.sql`)

- `blocks(blocker_id, blocked_id)` + RLS (owner-only; admin read). Feeds and
  search **exclude blocked authors**: `search_posts()` filters in SQL;
  `/api/search` (authors) and `/api/feed/trending` filter in the route.
  No block/unblock UI in Phase 3 — table + RLS are the foundation.
- `search_posts(query_text, lang_filter, result_limit, result_offset)` —
  trigram similarity on title/content, SECURITY INVOKER so caller RLS
  applies (kids only match kids-approved stories).
- **Guard-trigger fix:** Phase 1's `protect_profile_fields` /
  `protect_post_moderation_fields` blocked even the service role (no JWT →
  `is_admin()` false), which would have made the originality checker,
  strike system, moderation routes and view counter unable to write
  `originality_status` / `strike_count` / `is_suspended` / `view_count`.
  0002 re-creates both functions with one added exemption:
  `auth.role() = 'service_role'`. User-facing behavior unchanged.

## Pages & components

- Reader: `app/[lang]/posts/[id]/page.tsx` (+ `ViewCounter`, `LikeButton`,
  `SaveButton`, `FollowButton`, `CommentSection`, `ReportDialog`).
- Admin (`app/[lang]/admin/`, server-side `is_admin` guard → redirect):
  dashboard stat cards, `moderation` (tabs: stories / reports / originality
  holds), `kids` approvals, `users` (search, suspend/unsuspend, admin toggle,
  strike counts), `appeals`, `audit` log. Shared queue logic in
  `lib/admin-queries.ts` (used by API + pages).
- `NotificationBell` integrated into `Header.tsx` (additive edit only);
  polls every 60s, dropdown with mark-all-read.

## i18n

Phase 3 strings live in `lib/i18n/dictionaries/en.social.json` +
`ur.social.json` (identical key trees — verified; real Urdu translations).
`get-dictionary.ts` deep-merges base + social; `types.ts` defines
`Dictionary = typeof en & typeof enSocial` with a compile-time parity
check (`ur.social.json` must match `en.social.json` or `tsc` fails).

**Reconciliation note:** social top-level keys (`reader`, `social`,
`comments`, `notifications`, `appeals`, `search`, `admin`) were chosen to
not collide with base keys. To fold into single files later: copy those
keys into `en.json`/`ur.json`, delete `*.social.json`, drop `deepMerge`,
simplify `types.ts`.

## Contract cross-check
- `POST app/[lang]/api/internal/originality-check` `{postId}` ✅ (Phase 2
  publish flow calls it best-effort)
- Reader at `app/[lang]/posts/[id]/page.tsx` ✅
- `docs/PHASE2_NOTES.md` was absent — nothing to reconcile; Phase 2's
  assumptions used: `posts.category` holds the category slug (kids queue),
  publish flow sets `pending_review` then calls the check endpoint.
