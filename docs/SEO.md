# SEO strategy — realistic edition

## The one non-negotiable

**No one can guarantee Google rankings, and anyone promising "#1 on
Google" is lying.** Rankings depend on Google's algorithm, competition,
and hundreds of factors outside our control. What we *can* do is ship
clean technical SEO, publish genuinely useful content, and measure.

## What the build already does (technical SEO)

- [x] `metadata` export on `app/[lang]/layout.tsx`: title template
  (`%s · Qissa`), description from `SITE.tagline`.
- [x] `app/sitemap.ts`: static locale routes (`/`, `/feed`, `/kids`,
  …) for `en` + `ur`; commented hook showing exactly where to add
  dynamic `/posts/[id]` URLs once there's a live DB at request time.
- [x] `app/robots.ts`: allows `/`, disallows `/api/`, `/admin/`,
  `/dashboard`, `/write`, `/auth/`; advertises the sitemap.
- [x] Semantic HTML, per-locale `<html lang dir>` (Urdu pages render
  `dir="rtl"`), fast mostly-static pages.
- [ ] Still to do: per-post `generateMetadata` (title/description/OG
  tags) on `app/[lang]/posts/[id]/page.tsx`; Open Graph + Twitter card
  images; canonical URLs; Urdu `hreflang` annotations.

Set `NEXT_PUBLIC_SITE_URL` to the real domain on deploy, or the sitemap
advertises `http://localhost:3000`.

## Content strategy: own the Urdu long tail

"Qissa" (قصہ — "story/tale") is brandable and memorable. The realistic
path to traffic is **low-competition Urdu long-tail queries** where almost
nobody publishes well-formatted, original content:

- `bachon ki moral stories urdu me` / بچوں کی اخلاقی کہانیاں
- `urdu kahani` / اردو کہانی
- `sone se pehle ki kahani` / سونے سے پہلے کی کہانی
- `janwaron ki kahaniyan urdu me` / جانوروں کی کہانیاں

Tactics:

1. **Publish consistently.** A kids' story 2–3× per week beats a burst of
   50 posts once. The seed stories (`lib/seed/stories.ts`) are a start,
   not a library.
2. **One page per story, one query per page.** Descriptive Urdu titles,
   250–600 words, real categories and tags — exactly what the schema
   supports.
3. **Answer the query in the first paragraph.** Google's helpful-content
   systems reward pages that don't bury the answer.
4. **Internal linking.** Category pages (`/kids` chips, feed filters)
   link to stories; stories link back to categories.
5. **Original content only.** The originality checker exists to protect
   the corpus — thin or copied Urdu content is the fastest way to get
   ignored by search.

## What NOT to do

- Don't buy backlinks or use link farms — risks a manual penalty.
- Don't keyword-stuff titles; write for the parent searching at 9pm for
  a bedtime story.
- Don't trust any "SEO guru" promising rankings. Measure instead:
  Google Search Console (indexing, queries, CTR) from week one.

## Honest timeline

Expect **3–6 months** of consistent publishing before meaningful organic
traffic, longer for competitive English queries. Urdu kids' content is the
best bet for earlier wins because supply is thin — but "thin competition"
still isn't "no competition", and Google's sandbox for new domains is
real.
