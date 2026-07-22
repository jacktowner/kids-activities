import type { Activity } from "@/types/activity";

export function formatDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = startDate.toLocaleDateString("en-GB", opts);
  const endStr = endDate.toLocaleDateString("en-GB", opts);
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

export function formatPrice(activity: Pick<Activity, "isFree" | "priceMin" | "priceMax">) {
  if (activity.isFree) return "Free";
  if (activity.priceMin === activity.priceMax) return `£${activity.priceMin}`;
  return `£${activity.priceMin}–£${activity.priceMax}`;
}
