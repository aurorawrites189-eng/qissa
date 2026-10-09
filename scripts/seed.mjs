#!/usr/bin/env node
/**
 * Qissa demo seed script.
 *
 * Populates a fresh Supabase project with:
 *   1. Two demo users (created via auth.admin.createUser):
 *      - demo.author@qissa.example  (adult author of the seed stories)
 *      - demo.kid@qissa.example     (child reader, for testing Kids' World)
 *   2. Matching public.profiles rows.
 *   3. The six original sample stories from lib/seed/stories.ts, inserted
 *      as published posts (kids stories with is_kids_approved = true).
 *
 * Idempotent: re-running skips users and posts that already exist
 * (matched by email / by author+title).
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Required env (reads .env.local then .env, real environment wins):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Prerequisites: migrations 0001-0003 applied (`supabase db push`) and
 * supabase/seed.sql applied (categories must exist).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- minimal .env loader (no dependency) -----------------------------------
function loadEnvFile(name) {
  const path = join(ROOT, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

// --- config -----------------------------------------------------------------
const DEMO_PASSWORD = "QissaDemo123!"; // demo only — delete these users or change passwords after seeding
const DEMO_USERS = [
  {
    email: "demo.author@qissa.example",
    username: "demo_author",
    displayName: "Demo Author",
    bio: "Demo author account seeded with sample stories.",
    birthYear: 1990,
    ageClass: "adult",
    preferredLanguage: "en",
  },
  {
    email: "demo.kid@qissa.example",
    username: "demo_kid",
    displayName: "Demo Kid",
    bio: "Demo child reader account for testing the Kids' Story World.",
    birthYear: 2016,
    ageClass: "child",
    preferredLanguage: "ur",
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Missing env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(in .env.local or the environment) before running."
    );
    process.exit(1);
  }

  const { SEED_STORIES } = await import("../lib/seed/stories.ts");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Demo users (find-or-create) -------------------------------------------
  const { data: listed, error: listError } =
    await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const ids = {};
  for (const spec of DEMO_USERS) {
    const found = listed.users.find((u) => u.email === spec.email);
    let id;
    if (found) {
      id = found.id;
      console.log(`user exists, reusing: ${spec.email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: spec.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { username: spec.username },
      });
      if (error) throw error;
      id = data.user.id;
      console.log(`created user: ${spec.email}`);
    }
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id,
        username: spec.username,
        display_name: spec.displayName,
        bio: spec.bio,
        birth_year: spec.birthYear,
        age_class: spec.ageClass,
        preferred_language: spec.preferredLanguage,
      },
      { onConflict: "id" }
    );
    if (profileError) throw profileError;
    ids[spec.email] = id;
  }

  const authorId = ids["demo.author@qissa.example"];

  // 2. Sanity-check that the seed categories exist -----------------------------
  const needed = [...new Set(SEED_STORIES.map((s) => s.category))];
  const { data: cats, error: catError } = await supabase
    .from("categories")
    .select("slug")
    .in("slug", needed);
  if (catError) throw catError;
  const have = new Set((cats ?? []).map((c) => c.slug));
  const missing = needed.filter((s) => !have.has(s));
  if (missing.length > 0) {
    console.error(
      `Missing categories (apply supabase/seed.sql first): ${missing.join(", ")}`
    );
    process.exit(1);
  }

  // 3. Seed posts --------------------------------------------------------------
  let inserted = 0;
  let skipped = 0;
  for (const story of SEED_STORIES) {
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", authorId)
      .eq("title", story.title)
      .limit(1)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }
    const now = new Date().toISOString();
    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        author_id: authorId,
        title: story.title,
        content: story.content,
        language: story.language,
        category: story.category,
        tags: story.tags,
        status: "published",
        visibility: "public",
        moderation_status: "approved",
        originality_status: "low",
        is_kids_approved: story.isKids,
        published_at: now,
      })
      .select("id")
      .single();
    if (error) throw error;
    // Belt-and-braces: the insert-side trigger (migrations < 0003) resets
    // moderation fields for non-admin inserts. The update-side guard
    // explicitly exempts service_role, so force the intended values.
    const { error: fixError } = await supabase
      .from("posts")
      .update({
        moderation_status: "approved",
        originality_status: "low",
        is_kids_approved: story.isKids,
      })
      .eq("id", post.id);
    if (fixError) throw fixError;
    inserted++;
    console.log(`inserted: ${story.title}`);
  }

  console.log(`\nDone. posts inserted: ${inserted}, skipped (already seeded): ${skipped}`);
  console.log("Demo logins (password for both): " + DEMO_PASSWORD);
  console.log("  author (adult): demo.author@qissa.example");
  console.log("  kid reader:     demo.kid@qissa.example");
  console.log("Reminder: delete the demo users or change their passwords before going live.");
}

main().catch((e) => {
  console.error("Seed failed:", e.message ?? e);
  process.exit(1);
});
