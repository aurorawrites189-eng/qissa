import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/site-config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/Button";

export default async function HomePage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const lang = params.lang;
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <p className="text-5xl font-bold text-emerald-800 dark:text-emerald-400" lang="ur">
          {SITE.nameUrdu}
        </p>
        <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {dict.hero.title}
        </h1>
        <p className="max-w-xl text-lg text-neutral-600 dark:text-neutral-300">
          {dict.hero.subtitle}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/${lang}/auth/signup`}>
            <Button className="px-6 py-3 text-base">{dict.hero.ctaWrite}</Button>
          </Link>
          <Link href={`/${lang}/kids`}>
            <Button variant="secondary" className="px-6 py-3 text-base">
              {dict.hero.ctaRead}
            </Button>
          </Link>
        </div>
        <p className="max-w-xl text-sm text-neutral-500 dark:text-neutral-400">
          {dict.hero.kidsNote}
        </p>
      </section>

      {/* Value props */}
      <section className="grid gap-4 pb-20 sm:grid-cols-3">
        {[
          { title: lang === "ur" ? "دو زبانیں" : "Two languages", body: lang === "ur" ? "اردو اور انگریزی میں لکھیں اور پڑھیں۔" : "Write and read in Urdu and English." },
          { title: lang === "ur" ? "بچوں کے لیے محفوظ" : "Safe for kids", body: lang === "ur" ? "بچوں کا گوشہ ہر کہانی کی جانچ کے بعد ہی دکھاتا ہے۔" : "The Kids' Corner only shows reviewed stories." },
          { title: lang === "ur" ? "آپ کی آواز" : "Your voice", body: lang === "ur" ? "مسودے سے اشاعت تک، آپ کی کہانی آپ کے کنٹرول میں۔" : "From draft to published, your story stays yours." },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800"
          >
            <h2 className="mb-2 text-lg font-semibold">{f.title}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
