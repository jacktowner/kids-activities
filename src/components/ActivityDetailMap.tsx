"use client";

import dynamic from "next/dynamic";
import type { Activity } from "@/types/activity";

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((mod) => mod.ActivityMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-sm">
        Loading map…
      </div>
    ),
  }
);

export function ActivityDetailMap({ activity }: { activity: Activity }) {
  return <ActivityMap activities={[activity]} activeId={activity.id} focusId={activity.id} />;
}
