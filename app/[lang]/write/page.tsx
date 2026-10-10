import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { EditorForm } from "@/components/EditorForm";

/** New story: the editor creates a draft via POST /api/posts on mount. */
export default async function WritePage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  // Adult accounts only — explicit check (middleware redirects children too,
  // and RLS denies child writes; this keeps the page contract obvious).
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

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, name_en, name_ur, is_kids")
    .order("name_en");

  return (
    <EditorForm
      lang={lang}
      dict={dict}
      categories={(categories ?? []) as { slug: string; name_en: string; name_ur: string; is_kids: boolean }[]}
    />
  );
}
