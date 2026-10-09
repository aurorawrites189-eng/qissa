import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { PostCard, type PostCardPost } from "@/components/PostCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { NotificationsList, type DashboardNotification } from "@/components/dashboard/NotificationsList";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

const statusLabel = (status: string, d: { published: string; pendingReview: string; withheld: string; drafts: string }) =>
  status === "published"
    ? d.published
    : status === "pending_review"
      ? d.pendingReview
      : status === "withheld"
        ? d.withheld
        : d.drafts;

/**
 * Adult-only dashboard: profile editor, own posts (published / pending /
 * drafts), saved stories, followers & following, notifications and the
 * read-only violations/strikes history.
 */
export default async function DashboardPage({ params }: { params: { lang: string } }) {
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);
  const d = dict.dashboard;

  // Explicit age-class check: children are redirected to Kids' Corner.
  // (Middleware does this too; RLS is the final enforcer on every query.)
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/auth/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, preferred_language, age_class, strike_count, is_suspended, created_at"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect(`/${lang}/auth/login`);
  if (profile.age_class === "child") redirect(`/${lang}/kids`);

  const me = user.id;

  // Own posts by status (RLS: authors always see their own posts).
  const { data: myPosts } = await supabase
    .from("posts")
    .select("id, title, content, language, category, status, published_at, updated_at, post_images(storage_path, alt_text)")
    .eq("author_id", me)
    .order("updated_at", { ascending: false })
    .limit(100);

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_en, name_ur");
  const catList = (categories ?? []) as { slug: string; name_en: string; name_ur: string }[];
  const catName = (slug: string | null) => {
    const c = catList.find((x) => x.slug === slug);
    return c ? (lang === "ur" ? c.name_ur : c.name_en) : null;
  };

  const posts = ((myPosts ?? []) as Record<string, unknown>[]);
  const toCard = (p: Record<string, unknown>): PostCardPost => {
    const images = p.post_images as { storage_path: string; alt_text: string | null }[] | null;
    const content = p.content as string;
    return {
      id: p.id as string,
      title: p.title as string,
      language: p.language as string,
      excerpt: content.slice(0, 200) + (content.length > 200 ? "…" : ""),
      categoryName: catName((p.category as string | null) ?? null),
      published_at: (p.published_at as string | null) ?? (p.updated_at as string),
      wordCount: content.trim() === "" ? 0 : content.trim().split(/\s+/).length,
      author: null,
      cover: images?.[0] ? { storage_path: images[0].storage_path, alt_text: images[0].alt_text } : null,
    };
  };
  const published = posts.filter((p) => p.status === "published").map(toCard);
  const pending = posts.filter((p) => p.status === "pending_review");
  const drafts = posts.filter((p) => p.status === "draft");
  const withheld = posts.filter((p) => p.status === "withheld").map(toCard);

  // Saved stories.
  const { data: savedRows } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", me)
    .order("created_at", { ascending: false })
    .limit(30);
  const savedIds = (savedRows ?? []).map((r) => r.post_id as string);
  let savedCards: PostCardPost[] = [];
  if (savedIds.length > 0) {
    const { data: savedPosts } = await supabase
      .from("posts")
      .select("id, title, content, language, category, published_at, author_id, post_images(storage_path, alt_text)")
      .in("id", savedIds)
      .eq("status", "published");
    const authorIds = [...new Set(((savedPosts ?? []) as { author_id: string }[]).map((p) => p.author_id))];
    let authors: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {};
    if (authorIds.length > 0) {
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", authorIds);
      for (const p of profs ?? []) {
        authors[p.id as string] = {
          username: p.username as string,
          display_name: (p.display_name as string | null) ?? null,
          avatar_url: (p.avatar_url as string | null) ?? null,
        };
      }
    }
    savedCards = ((savedPosts ?? []) as Record<string, unknown>[]).map((p) => {
      const images = p.post_images as { storage_path: string; alt_text: string | null }[] | null;
      const content = p.content as string;
      return {
        id: p.id as string,
        title: p.title as string,
        language: p.language as string,
        excerpt: content.slice(0, 200) + (content.length > 200 ? "…" : ""),
        categoryName: catName((p.category as string | null) ?? null),
        published_at: (p.published_at as string | null) ?? null,
        author: authors[p.author_id as string] ?? null,
        cover: images?.[0] ? { storage_path: images[0].storage_path, alt_text: images[0].alt_text } : null,
      };
    });
  }

  // Followers / following via the public_profiles view.
  const { data: followerRows } = await supabase.from("follows").select("follower_id").eq("following_id", me);
  const { data: followingRows } = await supabase.from("follows").select("following_id").eq("follower_id", me);
  const followerIds = (followerRows ?? []).map((r) => r.follower_id as string);
  const followingIds = (followingRows ?? []).map((r) => r.following_id as string);
  const peopleIds = [...new Set([...followerIds, ...followingIds])];
  let people: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {};
  if (peopleIds.length > 0) {
    const { data: profs } = await supabase
      .from("public_profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", peopleIds);
    for (const p of profs ?? []) {
      people[p.id as string] = {
        username: p.username as string,
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      };
    }
  }

  // Notifications + violations (owner-only RLS).
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, payload, is_read, created_at")
    .eq("user_id", me)
    .order("created_at", { ascending: false })
    .limit(30);
  const { data: violations } = await supabase
    .from("violations")
    .select("id, type, status, created_at")
    .eq("user_id", me)
    .order("created_at", { ascending: false })
    .limit(30);

  const personChip = (id: string) => {
    const p = people[id];
    if (!p) return null;
    const name = p.display_name || p.username;
    return (
      <span key={id} className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-sm dark:bg-neutral-800">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        {name}
      </span>
    );
  };

  const memberSince = new Date(profile.created_at as string).toLocaleDateString(
    lang === "ur" ? "ur-PK" : "en-US",
    { year: "numeric", month: "long" }
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold">{d.title}</h1>
        <div className="flex gap-2">
          <Link href={`/${lang}/feed`}>
            <Button variant="secondary">{dict.nav.explore}</Button>
          </Link>
          <Link href={`/${lang}/write`}>
            <Button>{d.newStory}</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Section title={d.profile}>
            <ProfileEditor
              lang={lang}
              profile={{
                username: profile.username as string,
                display_name: (profile.display_name as string | null) ?? null,
                bio: (profile.bio as string | null) ?? null,
                avatar_url: (profile.avatar_url as string | null) ?? null,
                preferred_language: (profile.preferred_language as string) ?? "en",
              }}
              labels={{
                displayName: dict.settings.displayName,
                bio: dict.settings.bio,
                language: dict.settings.language,
                save: dict.settings.save,
                saved: dict.settings.saved,
                avatarHint: d.avatarHint,
                avatarTooBig: d.avatarTooBig,
                notAnImage: dict.write.notAnImage,
                changeAvatar: d.changeAvatar,
                uploading: dict.write.uploading,
                genericError: dict.validation.genericError,
              }}
            />
            <dl className="mt-6 space-y-2 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
              <div className="flex justify-between">
                <dt className="text-neutral-500">{d.account}</dt>
                <dd className="font-medium">@{profile.username as string}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{d.memberSince}</dt>
                <dd className="font-medium">{memberSince}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{d.status}</dt>
                <dd className="font-medium">
                  {profile.is_suspended ? d.suspended : d.active}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">{d.strikes}</dt>
                <dd className="font-medium">{profile.strike_count as number}</dd>
              </div>
            </dl>
          </Section>

          <Section title={`${d.followers} (${followerIds.length})`}>
            {followerIds.length === 0 ? (
              <p className="text-sm text-neutral-500">{d.noFollowers}</p>
            ) : (
              <div className="flex flex-wrap gap-2">{followerIds.map(personChip)}</div>
            )}
          </Section>

          <Section title={`${d.following} (${followingIds.length})`}>
            {followingIds.length === 0 ? (
              <p className="text-sm text-neutral-500">{d.noFollowing}</p>
            ) : (
              <div className="flex flex-wrap gap-2">{followingIds.map(personChip)}</div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Section title={d.notifications}>
            <NotificationsList
              initial={(notifications ?? []) as DashboardNotification[]}
              labels={{ markAllRead: d.markAllRead, noNotifications: d.noNotifications }}
            />
          </Section>

          <Section title={d.myPublished}>
            {published.length === 0 && withheld.length === 0 ? (
              <EmptyState title={d.emptyPublished} description={d.emptyStoriesBody} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {withheld.map((post) => (
                  <div key={post.id} className="relative">
                    <PostCard
                      lang={lang}
                      post={post}
                      labels={{ by: dict.posts.by, words: dict.posts.words, readMore: dict.common.readMore }}
                    />
                    <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      {statusLabel("withheld", d)}
                    </span>
                  </div>
                ))}
                {published.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    lang={lang}
                    labels={{ by: dict.posts.by, words: dict.posts.words, readMore: dict.common.readMore }}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={`${d.pendingReview} (${pending.length})`}>
            {pending.length === 0 ? (
              <p className="text-sm text-neutral-500">{d.emptyPending}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pending.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/10"
                  >
                    <span className="font-medium">{p.title as string}</span>
                    <span className="shrink-0 text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                      {statusLabel("pending_review", d)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={d.myDrafts}>
            {drafts.length === 0 ? (
              <EmptyState
                title={d.emptyDrafts}
                action={
                  <Link href={`/${lang}/write`}>
                    <Button>{d.newStory}</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {drafts.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{(p.title as string) || dict.write.untitled}</p>
                      <p className="text-xs text-neutral-500">
                        {new Date(p.updated_at as string).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link href={`/${lang}/write/${p.id as string}`}>
                        <Button variant="secondary">{dict.common.edit}</Button>
                      </Link>
                      <Link href={`/${lang}/posts/${p.id as string}`}>
                        <Button variant="ghost">{d.viewStory}</Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={d.mySaved}>
            {savedCards.length === 0 ? (
              <EmptyState title={d.emptySaved} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {savedCards.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    lang={lang}
                    labels={{ by: dict.posts.by, words: dict.posts.words, readMore: dict.common.readMore }}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={d.violations}>
            {!violations || violations.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{d.noViolations}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {violations.map((v) => (
                  <li
                    key={v.id as string}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
                  >
                    <span>
                      <span className="text-neutral-500">{d.type}: </span>
                      <span className="font-medium">{v.type as string}</span>
                    </span>
                    <span>
                      <span className="text-neutral-500">{d.status}: </span>
                      <span className="font-medium">{v.status as string}</span>
                    </span>
                    <span className="text-neutral-500">
                      {d.date}: {new Date(v.created_at as string).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
