import { SITE } from "@/lib/site-config";
import type { Dictionary } from "@/lib/i18n/types";

export function Footer({ dict }: { dict: Dictionary }) {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
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
