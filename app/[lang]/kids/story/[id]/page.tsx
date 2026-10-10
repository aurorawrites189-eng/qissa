import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { KidsStoryReader } from "@/components/KidsStoryReader";

/** Large-type kids' story reader. Only kids-approved published stories. */
export default async function KidsStoryPage({
  params: _params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, title, content, language, category, author_id")
    .eq("id", params.id)
    .eq("status", "published")
    .eq("is_kids_approved", true)
    .maybeSingle();

  // RLS is the final enforcer: a child session can never read a story that
  // isn't kids-approved, even if this filter were bypassed.
  if (!post) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_en, name_ur")
    .eq("is_kids", true);
  const cat = ((categories ?? []) as { slug: string; name_en: string; name_ur: string }[]).find(
    (c) => c.slug === (post.category as string | null)
  );

  const { data: author } = await supabase
    .from("public_profiles")
    .select("display_name, username")
    .eq("id", post.author_id as string)
    .maybeSingle();

  return (
    <div className="bg-gradient-to-b from-violet-50 via-white to-amber-50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900">
      <KidsStoryReader
        lang={lang}
        story={{
          id: post.id as string,
          title: post.title as string,
          content: post.content as string,
          language: (post.language as string) ?? "en",
          categoryName: cat ? (lang === "ur" ? cat.name_ur : cat.name_en) : null,
          authorName: author
            ? ((author.display_name as string | null) ?? (author.username as string))
            : null,
        }}
        labels={{
          backToStories: dict.kids.allStories,
          fontSize: dict.kids.fontSize,
          small: dict.kids.small,
          medium: dict.kids.medium,
          large: dict.kids.large,
          reportStory: dict.kids.reportStory,
          reportReason: dict.kids.reportReason,
          reportDetails: dict.kids.reportDetails,
          submitReport: dict.moderation.submitReport,
          cancel: dict.common.cancel,
          reportSent: dict.kids.reportSent,
          reportLogin: dict.kids.reportLogin,
          reasonInappropriate: dict.kids.reportReasonInappropriate,
          reasonScary: dict.kids.reportReasonScary,
          reasonOther: dict.kids.reportReasonOther,
        }}
      />
    </div>
  );
}
