import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatDateRange, formatPrice } from "@/lib/format";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ActivityDetailMap } from "@/components/ActivityDetailMap";
import type { Activity } from "@/types/activity";
import { parseCategories } from "@/lib/category";

type Props = { params: Promise<{ id: string }> };

async function getActivity(id: string) {
  const record = await prisma.activity.findUnique({ where: { id } });
  if (!record) return null;
  const activity: Activity = {
    ...record,
    startDate: record.startDate.toISOString(),
    endDate: record.endDate.toISOString(),
  };
  return activity;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) return { title: "Activity not found" };
  return {
    title: `${activity.title} | South London Kids Activities`,
    description: activity.description,
  };
}

export default async function ActivityDetailPage({ params }: Props) {
  const { id } = await params;
  const activity = await getActivity(id);
  if (!activity) notFound();

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

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        <div className="space-y-4">
          {activity.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activity.imageUrl}
              alt=""
              className="w-full h-56 object-cover rounded-xl"
            />
          )}

          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 leading-snug">
              {activity.title}
            </h1>
            <div className="flex shrink-0 gap-1.5">
              {activity.featured && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  ★ Featured
                </span>
              )}
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  activity.isFree
                    ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                    : "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                }`}
              >
                {formatPrice(activity)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {parseCategories(activity.category).map((category) => (
              <span
                key={category}
                className="inline-block text-[10px] uppercase tracking-wide px-1 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
              >
                {category}
              </span>
            ))}
          </div>

          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            {activity.description}
          </p>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              📍 {activity.venue}, {activity.address}, {activity.borough}
            </p>
            <p>
              🎂 Ages {activity.ageMin}–{activity.ageMax}
            </p>
            <p>📅 {formatDateRange(activity.startDate, activity.endDate)}</p>
            {activity.times && <p>🕒 {activity.times}</p>}
          </div>

          {activity.sourceUrl && (
            <a
              href={activity.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-teal-600 text-white text-sm font-medium px-4 py-2 hover:bg-teal-700 transition"
            >
              Visit {activity.sourceName || "source"} →
            </a>
          )}
        </div>

        <div className="h-[320px] lg:h-auto lg:min-h-[400px]">
          <ActivityDetailMap activity={activity} />
        </div>
      </div>
    </div>
  );
}
