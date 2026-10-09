export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-700 dark:border-neutral-700 dark:border-t-emerald-400"
      />
      {label && <span className="text-sm text-neutral-500">{label}</span>}
    </span>
  );
}
