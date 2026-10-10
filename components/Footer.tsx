import Link from "next/link";
import { SITE, type Locale } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";

export function Footer({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        <nav className="mb-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link href={`/${locale}/about`} className="hover:text-neutral-700 dark:hover:text-neutral-200">
            {dict.footer.about}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-neutral-700 dark:hover:text-neutral-200">
            {dict.footer.privacy}
          </Link>
          <Link href={`/${locale}/contact`} className="hover:text-neutral-700 dark:hover:text-neutral-200">
            {dict.footer.contact}
          </Link>
        </nav>
        <p>
          <span className="font-semibold text-neutral-700 dark:text-neutral-200">{SITE.name}</span>{" "}
          <span>{SITE.nameUrdu}</span> · {dict.footer.tagline}
        </p>
        <p>
          © {new Date().getFullYear()} {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
