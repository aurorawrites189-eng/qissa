import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  href?: string;
  accent?: "emerald" | "amber" | "red" | "sky" | "violet" | "neutral";
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, string> = {
  emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
  amber: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  red: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
  sky: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
  violet: "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40",
  neutral: "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
};

/** Small stat tile for the admin dashboard (server component). */
export function StatCard({ label, value, href, accent = "neutral" }: StatCardProps) {
  const body = (
    <div className={`rounded-2xl border p-5 ${ACCENTS[accent]}`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{label}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition hover:-translate-y-0.5">
        {body}
      </Link>
    );
  }
  return body;
}
