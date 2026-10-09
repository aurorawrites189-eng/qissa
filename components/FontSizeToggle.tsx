"use client";

export type KidsFontSize = "s" | "m" | "l";

interface FontSizeLabels {
  fontSize: string;
  small: string;
  medium: string;
  large: string;
}

/** S/M/L text-size toggle. The parent owns the value (persisted in localStorage). */
export function FontSizeToggle({
  value,
  onChange,
  labels,
}: {
  value: KidsFontSize;
  onChange: (size: KidsFontSize) => void;
  labels: FontSizeLabels;
}) {
  const sizes: { key: KidsFontSize; label: string; sample: string }[] = [
    { key: "s", label: labels.small, sample: "A" },
    { key: "m", label: labels.medium, sample: "A" },
    { key: "l", label: labels.large, sample: "A" },
  ];
  const sampleSize = { s: "text-sm", m: "text-lg", l: "text-2xl" };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900"
      role="group"
      aria-label={labels.fontSize}
    >
      <span className="px-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {labels.fontSize}
      </span>
      {sizes.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          aria-pressed={value === s.key}
          title={s.label}
          className={`flex h-9 w-9 items-center justify-center rounded-full font-bold transition ${
            value === s.key
              ? "bg-violet-600 text-white"
              : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          }`}
        >
          <span className={sampleSize[s.key]}>{s.sample}</span>
        </button>
      ))}
    </div>
  );
}
