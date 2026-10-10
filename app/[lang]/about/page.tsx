import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";

export async function generateMetadata({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) return {};
  const dict = await getDictionary(params.lang);
  return { title: dict.about.metaTitle };
}

export default async function AboutPage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const dict = await getDictionary(params.lang);
  const a = dict.about;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{a.title}</h1>
      <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">{a.intro}</p>
      <div className="mt-8 space-y-8">
        {a.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-xl font-semibold">{s.heading}</h2>
            <p className="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-300">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
