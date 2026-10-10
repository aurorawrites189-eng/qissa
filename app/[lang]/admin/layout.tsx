/**
 * /[lang]/admin layout: admin-only (redirects others) + section nav.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/site-config";

export default async function AdminLayout({
  children,
  params: _params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const params = await _params;
  const lang = params.lang as Locale;
  await requireAdminPage(lang);
  const dict = await getDictionary(lang);
  const nav = dict.admin.nav;

  const links = [
    { href: `/${lang}/admin`, label: dict.admin.dashboard.title },
    { href: `/${lang}/admin/moderation`, label: nav.moderation },
    { href: `/${lang}/admin/kids`, label: nav.kids },
    { href: `/${lang}/admin/users`, label: nav.users },
    { href: `/${lang}/admin/appeals`, label: nav.appeals },
    { href: `/${lang}/admin/audit`, label: nav.audit },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label={dict.admin.dashboard.title} className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
