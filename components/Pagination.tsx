import Link from "next/link";

interface PaginationLabels {
  previous: string;
  next: string;
  page: string;
  of: string;
}

/** Server-rendered pagination. `getHref` builds the URL for a page number. */
export function Pagination({
  page,
  totalPages,
  getHref,
  labels,
}: {
  page: number;
  totalPages: number;
  getHref: (page: number) => string;
  labels: PaginationLabels;
}) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p++) pages.push(p);

  const btn =
    "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700";
  const active = "bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-600";

  return (
    <nav
      aria-label={`${labels.page} ${page} ${labels.of} ${totalPages}`}
      className="mt-8 flex items-center justify-center gap-2"
    >
      {page > 1 ? (
        <Link href={getHref(page - 1)} className={`${btn} hover:bg-neutral-100 dark:hover:bg-neutral-800`}>
          ← {labels.previous}
        </Link>
      ) : (
        <span className={`${btn} cursor-not-allowed opacity-40`}>← {labels.previous}</span>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={getHref(p)}
          aria-current={p === page ? "page" : undefined}
          className={`${btn} ${p === page ? active : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
        >
          {p}
        </Link>
      ))}

      {page < totalPages ? (
        <Link href={getHref(page + 1)} className={`${btn} hover:bg-neutral-100 dark:hover:bg-neutral-800`}>
          {labels.next} →
        </Link>
      ) : (
        <span className={`${btn} cursor-not-allowed opacity-40`}>{labels.next} →</span>
      )}
    </nav>
  );
}
