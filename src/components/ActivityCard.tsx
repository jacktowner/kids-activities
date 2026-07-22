import type { Activity } from "@/types/activity";
import { formatDateRange, formatPrice } from "@/lib/format";

type Props = {
  activity: Activity;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
};

export function ActivityCard({ activity, isActive, onHover, onSelect }: Props) {
  return (
    <div
      id={`activity-${activity.id}`}
      onMouseEnter={() => onHover?.(activity.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onSelect?.(activity.id)}
      className={`bg-white rounded-xl border p-4 shadow-sm transition cursor-pointer hover:shadow-md hover:border-teal-300 ${
        isActive ? "border-teal-500 ring-2 ring-teal-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 leading-snug">{activity.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
            activity.isFree
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {formatPrice(activity)}
        </span>
      </div>

      <p className="text-sm text-slate-600 mt-2 line-clamp-3">{activity.description}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>📍 {activity.venue}, {activity.borough}</span>
        <span>🎂 Ages {activity.ageMin}–{activity.ageMax}</span>
        <span>📅 {formatDateRange(activity.startDate, activity.endDate)}</span>
        {activity.times && <span>🕒 {activity.times}</span>}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          {activity.category}
        </span>
        <a
          href={activity.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-teal-700 hover:text-teal-900 font-medium underline underline-offset-2"
        >
          View source: {activity.sourceName} →
        </a>
      </div>
    </div>
  );
}
