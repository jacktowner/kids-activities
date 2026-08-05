"use client";

import { useState } from "react";
import type { ActivityFilters } from "@/types/activity";
import type { UserLocation } from "@/components/ExplorePage";

type CategoryCount = { category: string; count: number };

type Meta = {
  boroughs: string[];
  categoryCounts: CategoryCount[];
  maxPrice: number;
};

type Props = {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  meta: Meta | null;
  resultCount: number;
  userLocation: UserLocation | null;
  onSetLocation: (location: UserLocation) => void;
  onClearLocation: () => void;
};

const CATEGORY_ICONS: Record<string, string> = {
  Sports: "⚽",
  "Arts & Crafts": "🎨",
  Nature: "🌳",
  "Museum & Heritage": "🏛️",
  STEM: "💡",
  "Multi-activity Camp": "🏕️",
  "Music & Drama": "🎭",
};

// Local date components, not toISOString (which is UTC-based and can shift the
// calendar date by a day for UK users during BST, e.g. just after local midnight).
function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Sat/Sun of the coming weekend — if today is already Sunday, "this weekend" is
// just today (Saturday's already passed), though a Sat-starting event still
// matches via the API's endDate >= dateFrom check.
function thisWeekendRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
  if (day === 0) return { from: toDateStr(now), to: toDateStr(now) };

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + ((6 - day + 7) % 7));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { from: toDateStr(saturday), to: toDateStr(sunday) };
}

function next7DaysRange(): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + 7);
  return { from: toDateStr(now), to: toDateStr(end) };
}

export function FilterPanel({
  filters,
  onChange,
  meta,
  resultCount,
  userLocation,
  onSetLocation,
  onClearLocation,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [customDatesOpen, setCustomDatesOpen] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function set<K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({});
    setCustomDatesOpen(false);
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported by your browser.");
      return;
    }
    setLocationError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onSetLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "your location",
        });
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : "Couldn't get your location."
        );
      }
    );
  }

  async function handlePostcodeSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = postcode.trim();
    if (!trimmed) return;

    setLocationError(null);
    setLocating(true);
    try {
      const res = await fetch(`/api/postcode?postcode=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setLocationError(res.status === 404 ? "Postcode not found." : "Postcode lookup failed.");
        return;
      }
      const { lat, lng } = await res.json();
      onSetLocation({ lat, lng, label: trimmed.toUpperCase() });
    } catch {
      setLocationError("Postcode lookup failed.");
    } finally {
      setLocating(false);
    }
  }

  const datePresets = [
    { label: "Any date", from: undefined, to: undefined },
    { label: "This weekend", ...thisWeekendRange() },
    { label: "Next 7 days", ...next7DaysRange() },
    { label: "Summer holidays", from: "2026-07-22", to: "2026-09-01" },
    { label: "October half term", from: "2026-10-26", to: "2026-11-01" },
  ] as const;

  const activeDatePreset = datePresets.find(
    (p) => p.from === filters.dateFrom && p.to === filters.dateTo
  );
  const showCustomDates =
    customDatesOpen || (!activeDatePreset && (filters.dateFrom || filters.dateTo));

  const categories = meta?.categoryCounts ?? [];
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  const advancedActiveCount = [
    !!filters.q,
    filters.age !== undefined,
    filters.freeOnly || filters.priceMax !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="rounded-2xl border-2 border-violet-200 dark:border-violet-800/60 bg-gradient-to-br from-violet-50 via-sky-50 to-teal-50 dark:from-slate-800 dark:via-slate-800 dark:to-slate-800 p-2 sm:p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-2 -mx-2 sm:-mx-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="lg:pointer-events-none flex items-center gap-1 text-lg font-bold text-slate-900 dark:text-slate-50"
        >
          🔎 Find an activity
          <span className={`lg:hidden text-xl leading-none transition-transform ${collapsed ? "" : "rotate-180"}`}>
            ▾
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {resultCount} {resultCount === 1 ? "activity" : "activities"}
          </span>
          <button
            onClick={reset}
            className="text-sm text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className={`${collapsed ? "hidden lg:block" : "block"} space-y-3`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* What */}
          <div className="rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-white/70 dark:bg-violet-900/20 p-3">
            <p className="flex items-center gap-1 text-sm font-bold text-violet-800 dark:text-violet-300 mb-2">
              🎈 What
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set("category", undefined)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  !filters.category
                    ? "bg-violet-600 text-white"
                    : "bg-violet-100 dark:bg-violet-800/50 text-violet-700 dark:text-violet-200 hover:bg-violet-200 dark:hover:bg-violet-800"
                }`}
              >
                All <span className="opacity-70">({totalCount})</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => set("category", filters.category === c.category ? undefined : c.category)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    filters.category === c.category
                      ? "bg-violet-600 text-white"
                      : "bg-violet-100 dark:bg-violet-800/50 text-violet-700 dark:text-violet-200 hover:bg-violet-200 dark:hover:bg-violet-800"
                  }`}
                >
                  {CATEGORY_ICONS[c.category] ?? "🔸"} {c.category}
                </button>
              ))}
            </div>
          </div>

          {/* Where */}
          <div className="rounded-xl border-2 border-teal-300 dark:border-teal-700 bg-white/70 dark:bg-teal-900/20 p-3">
            <p className="flex items-center gap-1 text-sm font-bold text-teal-800 dark:text-teal-300 mb-2">
              📍 Where
            </p>
            <details className="group relative">
              <summary className="w-full list-none cursor-pointer rounded-lg border border-teal-400 dark:border-teal-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center justify-between">
                <span>
                  {!filters.borough || filters.borough.length === 0
                    ? "All London"
                    : filters.borough.length === 1
                      ? filters.borough[0]
                      : `${filters.borough.length} boroughs selected`}
                </span>
                <span className="text-xs transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-teal-400 dark:border-teal-600 bg-white dark:bg-slate-900 shadow-lg p-2 space-y-0.5">
                {meta?.boroughs.map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 px-1 py-0.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.borough?.includes(b) ?? false}
                      onChange={(e) => {
                        const current = filters.borough ?? [];
                        const next = e.target.checked
                          ? [...current, b]
                          : current.filter((x) => x !== b);
                        set("borough", next.length > 0 ? next : undefined);
                      }}
                      className="accent-teal-600 h-4 w-4"
                    />
                    {b}
                  </label>
                ))}
                {filters.borough && filters.borough.length > 0 && (
                  <button
                    type="button"
                    onClick={() => set("borough", undefined)}
                    className="w-full text-left text-xs text-teal-700 dark:text-teal-400 hover:underline pt-1"
                  >
                    Clear boroughs
                  </button>
                )}
              </div>
            </details>

            {userLocation ? (
              <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-teal-800 dark:text-teal-300">
                <span className="truncate">📍 Near {userLocation.label}</span>
                <button
                  type="button"
                  onClick={onClearLocation}
                  className="shrink-0 text-teal-700 dark:text-teal-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="mt-1.5 space-y-1">
                <div className="flex gap-1.5">
                  <form onSubmit={handlePostcodeSearch} className="flex-1 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Postcode"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      className="w-full min-w-0 rounded-lg border border-teal-400 dark:border-teal-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="submit"
                      disabled={locating}
                      className="shrink-0 rounded-lg bg-teal-600 text-white text-xs font-medium px-2.5 py-1 hover:bg-teal-700 transition disabled:opacity-50"
                    >
                      Search
                    </button>
                  </form>
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="w-full text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50"
                >
                  {locating ? "Locating…" : "📍 Activities in my location"}
                </button>
                {locationError && <p className="text-xs text-red-600 dark:text-red-400">{locationError}</p>}
              </div>
            )}
          </div>

          {/* When */}
          <div className="rounded-xl border-2 border-sky-300 dark:border-sky-700 bg-white/70 dark:bg-sky-900/20 p-3">
            <p className="flex items-center gap-1 text-sm font-bold text-sky-800 dark:text-sky-300 mb-2">
              📅 When
            </p>
            <div className="flex flex-wrap gap-1.5">
              {datePresets.map((preset) => {
                const active = activeDatePreset?.label === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onChange({ ...filters, dateFrom: preset.from, dateTo: preset.to });
                      setCustomDatesOpen(false);
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? "bg-sky-600 text-white"
                        : "bg-sky-100 dark:bg-sky-800/50 text-sky-700 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomDatesOpen((v) => !v)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  showCustomDates && !activeDatePreset
                    ? "bg-sky-600 text-white"
                    : "bg-sky-100 dark:bg-sky-800/50 text-sky-700 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800"
                }`}
              >
                Choose dates…
              </button>
            </div>
            {showCustomDates && (
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(e) => set("dateFrom", e.target.value || undefined)}
                  className="w-1/2 rounded-lg border border-sky-400 dark:border-sky-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(e) => set("dateTo", e.target.value || undefined)}
                  className="w-1/2 rounded-lg border border-sky-400 dark:border-sky-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center border-t border-violet-100 dark:border-violet-800/40 pt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300"
          >
            {expanded ? "Fewer filters" : "More filters"}
            {!expanded && advancedActiveCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-teal-600 text-white text-[10px]">
                {advancedActiveCount}
              </span>
            )}
            <span className={`transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
          </button>
        </div>

        {expanded && (
          <div className="flex flex-wrap items-end gap-3 border-t border-violet-100 dark:border-violet-800/40 pt-2">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                Search
              </label>
              <input
                type="text"
                placeholder="e.g. football, art, park name..."
                value={filters.q ?? ""}
                onChange={(e) => set("q", e.target.value || undefined)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="w-40">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                Child&apos;s age
              </label>
              <select
                value={filters.age ?? ""}
                onChange={(e) => set("age", e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Any age</option>
                {Array.from({ length: 13 }, (_, i) => i + 4).map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0 pb-1">
              <input
                type="checkbox"
                checked={filters.freeOnly ?? false}
                onChange={(e) => set("freeOnly", e.target.checked || undefined)}
                className="accent-teal-600 h-4 w-4"
              />
              Free activities only
            </label>
            {!filters.freeOnly && (
              <div className="flex-1 min-w-[240px] flex items-center gap-2 pb-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
                  Max price: {filters.priceMax !== undefined ? `£${filters.priceMax}` : "any"}
                </label>
                <input
                  type="range"
                  min={0}
                  max={meta?.maxPrice ?? 50}
                  value={filters.priceMax ?? meta?.maxPrice ?? 50}
                  onChange={(e) => set("priceMax", Number(e.target.value))}
                  className="flex-1 accent-teal-600"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
