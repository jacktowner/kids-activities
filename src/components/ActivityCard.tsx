import { useState } from "react";
import Link from "next/link";
import type { Activity } from "@/types/activity";
import { formatDateRange, formatPrice } from "@/lib/format";

type Props = {
  activity: Activity;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  onCategoryClick?: (category: string) => void;
};

export function ActivityCard({ activity, isActive, onHover, onSelect, onCategoryClick }: Props) {
  const [copied, setCopied] = useState(false);

  function copyWithFallback(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // give up silently — no clipboard access available
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const shareData = {
      title: activity.title,
      text: `${activity.title} — ${activity.venue}, ${activity.borough}`,
      url: activity.sourceUrl,
    };
    // navigator.share / navigator.clipboard only exist in secure contexts
    // (https, or localhost) — fall back to execCommand for plain http (e.g.
    // testing on a phone against the dev machine's LAN IP).
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user dismissed the share sheet
      }
      return;
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(activity.sourceUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      } catch {
        // fall through to legacy fallback
      }
    }
    copyWithFallback(activity.sourceUrl);
  }

  return (
    <div
      id={`activity-${activity.id}`}
      onMouseEnter={() => onHover?.(activity.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onSelect?.(activity.id)}
      className={`bg-white dark:bg-slate-800 rounded-xl border p-4 shadow-sm transition cursor-pointer hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600 ${
        isActive
          ? "border-teal-500 ring-2 ring-teal-200 dark:ring-teal-800"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      {activity.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activity.imageUrl}
          alt=""
          className="w-full h-36 object-cover rounded-lg mb-3"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-50 leading-snug">
          {activity.title}
        </h3>
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

      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">
        {activity.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>📍 {activity.venue}, {activity.borough}</span>
        <span>🎂 Ages {activity.ageMin}–{activity.ageMax}</span>
        <span>📅 {formatDateRange(activity.startDate, activity.endDate)}</span>
        {activity.times && <span>🕒 {activity.times}</span>}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCategoryClick?.(activity.category);
        }}
        className="mt-1.5 text-[10px] uppercase tracking-wide px-1 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-teal-100 dark:hover:bg-teal-800 hover:text-teal-700 dark:hover:text-teal-200 transition"
      >
        {activity.category}
      </button>

      <div className="mt-2 flex items-center justify-between gap-3">
        <Link
          href={`/activity/${activity.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium underline underline-offset-2"
        >
          View details →
        </Link>
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share this activity"
          title={copied ? "Link copied!" : "Share"}
          className="text-slate-400 dark:text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 transition"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L7.04 9.81C6.5 9.31 5.79 9 5 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
