# Qissa — Phase 2 Notes (core writing, Kids' Story World, dashboards)

Phase 2 builds on the Phase 1 scaffold (auth, RLS, i18n, storage buckets).
All code is real and wired to Supabase; there are no stubs.

## Seed data

- `supabase/seed.sql` — 14 categories, `ON CONFLICT (slug) DO NOTHING` (safe to re-run):
  - kids (`is_kids=true`): moral-stories, animal-stories, fairy-tales, adventure,
    kindness, educational, science-nature, bedtime
  - general: articles, short-stories, poetry, essays, travel, technology
- Apply after `supabase/migrations/0001_schema.sql`.

## API endpoints (all under `/[lang]/api/...`)

| Method & path | Auth | Notes |
|---|---|---|
| `GET /[lang]/api/posts?lang=&category=&q=&page=&limit=` | public | Published + public only (anon). RLS narrows child sessions to kids-approved. Returns `{posts, page, limit, total, total_pages}`; authors resolved via `public_profiles` view; cover via `post_images`. |
| `POST /[lang]/api/posts` | adult only (explicit **403** for `age_class='child'`) | Creates a draft; accepts partial body (zod `postSchema.partial()`), defaults title to "Untitled". Rate-limited. |
| `GET /[lang]/api/posts/[id]` | public | Single post + author + cover images. Visibility enforced by RLS (`can_view_post`). |
| `PATCH /[lang]/api/posts/[id]` | adult, own post only | Autosave/edit fields; `cover_image: {storage_path, alt_text} \| null` replaces the single cover row in `post_images`. With `{action:"publish"}`: full zod validation of the merged post, `status='pending_review'`, `originality_status='unchecked'`; if `submit_as_kids=true` the category must be a kids category (400 otherwise). Rate-limited. |
| `DELETE /[lang]/api/posts/[id]` | adult, own post only | 404 for other authors' posts. Rate-limited. |
| `POST /[lang]/api/upload` | adult only (**403** child) | Multipart `file` → image/\* ≤5MB → `post-images` bucket at `<user_id>/<uuid>.<ext>` via service-role client → `{storage_path}`. Rate-limited. |
| `POST /[lang]/api/profile/avatar` | any signed-in user | Multipart `file` → image/\* ≤2MB → `avatars` bucket at `<user_id>/avatar.<ext>` (upsert) → updates `profiles.avatar_url` → `{avatar_url}`. Rate-limited. |
| `PATCH /[lang]/api/profile` | any signed-in user | Updates `display_name`, `bio`, `preferred_language` on own row (the `protect_profile_fields` trigger guards privileged columns). Rate-limited. |
| `POST /[lang]/api/kids/history` | any signed-in user (kids allowed) | Upserts `reading_history {user_id, post_id, last_read_at}`. See middleware caveat below. Rate-limited. |

Shared helpers: `lib/api/respond.ts` (`requireUser`, `requireAdult`, `rateLimitOr429`,
`clientIp`, `json`), `lib/storage.ts` (`publicStorageUrl`).

## Contract with Phase 3

1. **Originality check.** On publish, `PATCH /api/posts/[id]` fires a best-effort
   `POST /api/internal/originality-check` with body `{ postId }` (absolute URL
   derived from the request origin, 5s timeout, response drained and ignored).
   The endpoint is built by a parallel agent and may not exist yet — **any**
   failure (DNS, 404, 500, timeout) is swallowed and the post simply stays
   `pending_review` with `originality_status='unchecked'`, so moderators or a
   later Phase-3 job can run the check. `docs` truth: `originality_check:
   "triggered_best_effort"` in the PATCH response does NOT mean it succeeded.
2. **Reader page.** `PostCard` and the dashboard link to `/[lang]/posts/[id]`
   — Phase 3 builds that full reader page (likes, comments, view counting,
   save/unsave live there). Phase 2 does not create it.
3. **Notifications** of types `post_published`, `post_withheld`,
   `post_pending_review`, `violation`, `appeal_decided`, `new_follower` are
   rendered by the dashboard; Phase 3/moderation flows should insert rows with
   those types and a `payload` like `{title}` / `{reason}` / `{username}`.

## Pages

- `/[lang]/write` — adult-only editor shell; creates a draft on mount via the
  API, then swaps to `/[lang]/write/[id]`. `components/EditorForm.tsx`:
  title/content (word count), language, category, tags, visibility
  (public/unlisted), cover upload + alt text, 30s autosave (PATCH), preview
  toggle, "Submit for review", "Submit as kids' story" (requires kids
  category), delete draft.
- `/[lang]/write/[id]` — edit **own draft only** (404 for other authors or
  non-draft statuses).
- `/[lang]/feed` — published+public stories with language/category/text
  filters (URL-synced, debounced search) + pagination. Cards link to
  `/[lang]/posts/[id]` (Phase 3 reader).
- `/[lang]/kids` — extended Kids' Story World: playful gradient + big rounded
  cards, category chips (`is_kids` categories), search box, S/M/L font-size
  toggle persisted in `localStorage` (`qissa-kids-font`), "continue reading"
  shelf from `reading_history`.
- `/[lang]/kids/story/[id]` — large-type reader with font-size toggle,
  language/category badges, and a Report button (inserts into `reports`
  directly — `reports_insert_own` RLS allows kids; anonymous users get a
  login link).
- `/[lang]/dashboard` — **adult only** (explicit `age_class` check +
  `redirect('/[lang]/kids')` for children, on top of the middleware redirect
  and RLS): profile editor (display name, bio, avatar, preferred language),
  account facts (username, member-since, status, strikes), published (incl.
  withheld flag) / pending-review / drafts (edit links) / saved sections,
  followers & following counts + lists via the `public_profiles` view,
  notifications with mark-read, read-only violations/strikes history.

## Known integration caveat (kids reading history)

> **Phase 4 update — FIXED.** `middleware.ts` now has an explicit child API
> allowlist: children may call `/[lang]/api/kids/*`, `POST /[lang]/api/reports`,
> and `GET /[lang]/api/notifications`; everything else under `/api/*` stays
> blocked for children (RLS backstops regardless). The paragraph below
> describes the pre-fix behavior and is kept for history.

Phase-1 `middleware.ts` only allows child accounts on `/[lang]`,
`/[lang]/kids*` and auth paths — a signed-in child's `fetch` to
`/[lang]/api/kids/history` is 307-redirected to the Kids' page, so the
browser receives HTML instead of JSON. The client (`KidsStoryReader`)
therefore treats history recording as best-effort: it calls the API route,
and if the response isn't JSON it falls back to a direct Supabase upsert
(RLS `reading_history_insert_own`/`_update_own` permit this for kids).
Nothing else depends on history succeeding.

## Validation & rate limiting

- `lib/validation.ts` extended: `postUpdateSchema` (partial + `action`,
  `submit_as_kids`, `visibility`, `cover_image`), `coverImageSchema`,
  `profileUpdateSchema`, `postsQuerySchema`.
- All write endpoints rate-limited via `lib/rate-limit.ts`
  (`posts:create/update/delete`, `upload`, `avatar`, `profile:update`,
  `kids:history`).

## i18n

Every new UI string added to **both** `lib/i18n/dictionaries/en.json` and
`ur.json` (real Urdu translations); key trees are identical (enforced by
`Dictionary = typeof en` in `lib/i18n/types.ts`). New sections: `feed`,
`pagination`, `posts`; extended: `common` (next/of/page/previous),
`dashboard`, `kids`, `write`.
