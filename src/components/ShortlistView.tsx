"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActivityCard } from "@/components/ActivityCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useShortlist } from "@/lib/shortlist";
import type { Activity } from "@/types/activity";

export function ShortlistView() {
  const { ids, count, clear } = useShortlist();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // The shortlist is just a set of ids, so pull the full published listing once
  // and pick out the saved ones. Anything since expired or unpublished simply
  // won't come back and drops off the shortlist view.
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => fetch("/api/activities", { signal: controller.signal }))
      .then((res) => res.json())
      .then((data: Activity[]) => setActivities(data))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const saved = useMemo(() => {
    const byId = new Map(activities.map((a) => [a.id, a]));
    return ids.map((id) => byId.get(id)).filter((a): a is Activity => Boolean(a));
  }, [activities, ids]);

  const missing = count - saved.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 w-full flex-1 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium underline underline-offset-2"
        >
          ← Back to all activities
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Your shortlist
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {count === 0
              ? "You haven't saved any activities yet."
              : `${count} saved ${count === 1 ? "activity" : "activities"}`}
            {missing > 0 && ` · ${missing} no longer available`}
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
          >
            Clear shortlist
          </button>
        )}
      </div>

      {loading && count > 0 && (
        <p className="text-sm text-slate-400 py-8 text-center">Loading your shortlist…</p>
      )}

      {count === 0 && (
        <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
          <p>
            Browse the{" "}
            <Link
              href="/"
              className="text-teal-700 dark:text-teal-400 font-medium underline underline-offset-2"
            >
              activity finder
            </Link>{" "}
            and tap the bookmark on any listing to save it here.
          </p>
        </div>
      )}

      {saved.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {saved.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}
