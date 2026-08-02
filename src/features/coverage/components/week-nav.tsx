"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Week navigation for the coverage dashboard: previous / next / today, plus a
 * date picker to jump to any week. Prev/next/today are plain links (server-
 * computed hrefs); the picker uses the router to jump to whatever week contains
 * the chosen date. Everything drives the `?week=` query param.
 */
export function WeekNav({
  weekStart,
  prevWeek,
  nextWeek,
  todayWeek,
}: {
  weekStart: string;
  prevWeek: string;
  nextWeek: string;
  todayWeek: string;
}) {
  const router = useRouter();

  const linkClass =
    "rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/coverage?week=${prevWeek}`} className={linkClass} aria-label="Previous week">
        ← Prev
      </Link>
      <Link href={`/coverage?week=${nextWeek}`} className={linkClass} aria-label="Next week">
        Next →
      </Link>
      <Link
        href={`/coverage?week=${todayWeek}`}
        className={linkClass}
        aria-disabled={weekStart === todayWeek}
      >
        Today
      </Link>
      <label className="ml-auto flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
        <span className="hidden sm:inline">Jump to</span>
        <input
          type="date"
          defaultValue={weekStart}
          onChange={(e) => {
            const value = e.target.value;
            if (value) router.push(`/coverage?week=${value}`);
          }}
          className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20 [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>
    </div>
  );
}
