import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale } from "@/lib/i18n/config";

export async function generateMetadata({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) return {};
  const dict = await getDictionary(params.lang);
  return { title: dict.contact.metaTitle };
}

export default async function ContactPage({ params: _params }: { params: Promise<{ lang: string }> }) {
  const params = await _params;
  if (!isLocale(params.lang)) notFound();
  const dict = await getDictionary(params.lang);
  const c = dict.contact;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{c.title}</h1>
      <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">{c.intro}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-1">
        {c.items.map((item) => (
          <div
            key={item.heading}
            className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800"
          >
            <h2 className="text-lg font-semibold">{item.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {item.body}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">{c.note}</p>
    </div>
  );
}
