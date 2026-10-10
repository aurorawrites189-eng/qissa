import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { EditorForm, type EditorInitialPost } from "@/components/EditorForm";

/** Edit your own draft. Anything else (other authors, non-drafts) → 404. */
export default async function EditDraftPage({
  params: _params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/login`);
  const { data: profile } = await supabase
    .from("profiles")
    .select("age_class")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.age_class === "child") redirect(`/${lang}/kids`);

  const { data: post } = await supabase
    .from("posts")
    .select("id, author_id, title, content, language, category, tags, status, visibility")
    .eq("id", params.id)
    .eq("author_id", user.id)
    .maybeSingle();

  // Only the author's own DRAFTS are editable here — published or
  // pending-review posts are read-only once submitted.
  if (!post || post.status !== "draft") notFound();

  const { data: images } = await supabase
    .from("post_images")
    .select("storage_path, alt_text")
    .eq("post_id", post.id)
    .limit(1);
  const cover = images?.[0]
    ? {
        storage_path: images[0].storage_path as string,
        alt_text: (images[0].alt_text as string | null) ?? null,
      }
    : null;

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_en, name_ur, is_kids")
    .order("name_en");

  const initialPost: EditorInitialPost = {
    id: post.id as string,
    title: (post.title as string) ?? "",
    content: (post.content as string) ?? "",
    language: (post.language as string) ?? "en",
    category: (post.category as string | null) ?? null,
    tags: (post.tags as string[]) ?? [],
    status: post.status as string,
    visibility: (post.visibility as string) ?? "public",
    cover,
  };

  return (
    <EditorForm
      lang={lang}
      dict={dict}
      categories={(categories ?? []) as { slug: string; name_en: string; name_ur: string; is_kids: boolean }[]}
      initialPost={initialPost}
    />
  );
}
