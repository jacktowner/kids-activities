"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FilterPanel } from "@/components/FilterPanel";
import { ActivityCard } from "@/components/ActivityCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountNav } from "@/components/AccountNav";
import type { Activity, ActivityFilters } from "@/types/activity";
import { haversineKm } from "@/lib/distance";
import { useShortlist } from "@/lib/shortlist";

export type UserLocation = { lat: number; lng: number; label: string };

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((mod) => mod.ActivityMap),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

function MapPlaceholder() {
  return (
    <div className="h-full w-full rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-sm">
      Loading map…
    </div>
  );
}

type Meta = {
  boroughs: string[];
  categories: string[];
  categoryCounts: { category: string; count: number }[];
  maxPrice: number;
};

type SortKey = "name" | "date" | "price" | "subjects" | "borough" | "distance";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "subjects", label: "Subjects" },
  { key: "borough", label: "Borough" },
  { key: "distance", label: "Distance" },
];

// Small seeded PRNG so a given shuffle seed produces the same order on every
// render (a bare Math.random() shuffle would reshuffle the list on each render).
function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortActivities(
  activities: Activity[],
  sortKey: SortKey,
  sortDir: SortDir,
  userLocation: UserLocation | null,
  shuffleSeed: number | null
) {
  let ordered: Activity[];
  if (shuffleSeed !== null) {
    ordered = seededShuffle(activities, shuffleSeed);
  } else {
    const sorted = [...activities].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.title.localeCompare(b.title);
        case "date":
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        case "price":
          return (a.isFree ? 0 : a.priceMin) - (b.isFree ? 0 : b.priceMin);
        case "subjects":
          return a.category.localeCompare(b.category);
        case "borough":
          return a.borough.localeCompare(b.borough);
        case "distance":
          if (!userLocation) return 0;
          return haversineKm(userLocation, a) - haversineKm(userLocation, b);
      }
    });
    ordered = sortDir === "desc" ? sorted.reverse() : sorted;
  }
  // Featured activities always lead the list, regardless of sort/shuffle — order
  // is stable within each group so the chosen order still applies inside it.
  return [...ordered.filter((a) => a.featured), ...ordered.filter((a) => !a.featured)];
}

const PAGE_SIZE = 12;

type ActivityListPanelProps = {
  activities: Activity[];
  loading: boolean;
  activeId: string | null;
  /** An activity to reveal (growing the paged-in slice if needed) and scroll to. */
  listFocusId: string | null;
  hidden: boolean;
  compact: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onCategoryClick: (category: string) => void;
};

// Keyed by the caller on the current filter/sort signature, so a fresh instance
// (and a fresh PAGE_SIZE) mounts whenever the underlying list criteria change,
// instead of needing an effect to reset paging state.
function ActivityListPanel({
  activities,
  loading,
  activeId,
  listFocusId,
  hidden,
  compact,
  onHover,
  onSelect,
  onCategoryClick,
}: ActivityListPanelProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visibleActivities = useMemo(
    () => activities.slice(0, visibleCount),
    [activities, visibleCount]
  );

  // Grows the visible slice of the (already-fetched) list as the user scrolls
  // near the bottom of the list panel, rather than paging the API.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, activities.length));
        }
      },
      { root, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activities.length]);

  // A pin selected on the map can be further down the sorted list than the
  // currently-paged-in slice (infinite scroll only renders PAGE_SIZE at a time),
  // so grow the slice to include it before trying to scroll to it.
  useEffect(() => {
    if (!listFocusId) return;
    const index = activities.findIndex((a) => a.id === listFocusId);
    if (index === -1) return;

    Promise.resolve()
      .then(() => {
        if (index >= visibleCount) setVisibleCount(index + 1);
      })
      .then(() => {
        requestAnimationFrame(() => {
          document.getElementById(`activity-${listFocusId}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
      });
  }, [listFocusId, activities, visibleCount]);

  return (
    <div
      ref={listRef}
      className={`space-y-3 overflow-y-auto max-h-[70vh] lg:max-h-[calc(100vh-220px)] pr-1 ${
        hidden ? "hidden lg:block" : ""
      }`}
    >
      {loading && <p className="text-sm text-slate-400 py-8 text-center">Loading activities…</p>}
      {!loading && activities.length === 0 && (
        <p className="text-sm text-slate-400 py-8 text-center">
          No activities match your filters. Try widening your search.
        </p>
      )}
      {visibleActivities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          isActive={activity.id === activeId}
          compact={compact}
          onHover={onHover}
          onSelect={onSelect}
          onCategoryClick={onCategoryClick}
        />
      ))}
      {visibleActivities.length < activities.length && (
        <>
          <div ref={sentinelRef} className="h-1" />
          <p className="text-xs text-slate-400 text-center py-2">
            Showing {visibleActivities.length} of {activities.length} — scroll for more
          </p>
        </>
      )}
    </div>
  );
}

function buildQuery(filters: ActivityFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.borough && filters.borough.length > 0) params.set("borough", filters.borough.join(","));
  if (filters.category) params.set("category", filters.category);
  if (filters.age !== undefined) params.set("age", String(filters.age));
  if (filters.freeOnly) params.set("freeOnly", "true");
  if (!filters.freeOnly && filters.priceMax !== undefined)
    params.set("priceMax", String(filters.priceMax));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

export function ExplorePage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [listFocusId, setListFocusId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Non-null when the user has hit "Randomise" — holds the seed for the shuffle
  // (see seededShuffle). Any real sort choice clears it back to null.
  const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);
  // Cards default to compact below the lg breakpoint and expanded at/above it.
  // densityChoice stays null until the user taps the (mobile-only) density
  // toggle; while null, `density` follows the viewport via `isNarrow` below.
  const [densityChoice, setDensityChoice] = useState<"compact" | "expanded" | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const density = densityChoice ?? (isNarrow ? "compact" : "expanded");
  const [listWidthPct, setListWidthPct] = useState(66.67);
  const [isDragging, setIsDragging] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const { count: shortlistCount } = useShortlist();

  function handleSetLocation(location: UserLocation) {
    setUserLocation(location);
    setSortKey("distance");
    setSortDir("asc");
    setShuffleSeed(null);
  }

  function handleClearLocation() {
    setUserLocation(null);
    setSortKey("date");
    setShuffleSeed(null);
  }

  // Track the sub-lg breakpoint so the card-density default follows the viewport
  // even when it changes after mount (resizing a desktop window down, rotating a
  // tablet). setState only fires from the deferred sync / the change listener,
  // never synchronously in the effect body, per react-hooks/set-state-in-effect.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const sync = () => setIsNarrow(mq.matches);
    Promise.resolve().then(sync);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Drag-to-resize the list/map split (desktop only — the resizer handle below is
  // hidden below the lg breakpoint). Only subscribes to window pointer events while
  // a drag is in progress, and only calls setState from inside those listener
  // callbacks, not synchronously in the effect body.
  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(e: PointerEvent) {
      const container = panelsRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setListWidthPct(Math.min(80, Math.max(20, pct)));
    }

    function handlePointerUp() {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta({ boroughs: [], categories: [], categoryCounts: [], maxPrice: 50 }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = buildQuery(filters);
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => fetch(`/api/activities${query ? `?${query}` : ""}`, { signal: controller.signal }))
      .then((res) => res.json())
      .then((data) => setActivities(data))
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters]);

  const activeActivity = useMemo(
    () => activities.find((a) => a.id === activeId) ?? null,
    [activities, activeId]
  );

  const sortedActivities = useMemo(
    () => sortActivities(activities, sortKey, sortDir, userLocation, shuffleSeed),
    [activities, sortKey, sortDir, userLocation, shuffleSeed]
  );

  function handleSelectFromList(id: string) {
    setActiveId(id);
    setFocusId(id);
    setView("map");
  }

  function handleMarkerClick(id: string) {
    setActiveId(id);
    setFocusId(id);
    setView("list");
    setListFocusId(id);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col gap-6">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <h1 className="min-w-0 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
            London Kids Activities
          </h1>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/shortlist"
              title="View your shortlist"
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
              </svg>
              <span className="hidden sm:inline">Shortlist</span>
              {shortlistCount > 0 && (
                <span className="rounded-full bg-teal-600 text-white text-xs font-semibold px-1.5 min-w-[1.25rem] text-center">
                  {shortlistCount}
                </span>
              )}
            </Link>
            <AccountNav isLoggedIn={isLoggedIn} />
            <ThemeToggle />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
          Holiday clubs, camps and drop-in activities for ages 4–16, curated from council,
          museum and local organiser listings across London.
        </p>
      </header>

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        meta={meta}
        resultCount={activities.length}
        userLocation={userLocation}
        onSetLocation={handleSetLocation}
        onClearLocation={handleClearLocation}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="lg:hidden flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-fit">
            <button
              onClick={() => setView("list")}
              className={`px-4 py-2 text-sm font-medium ${
                view === "list"
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView("map")}
              className={`px-4 py-2 text-sm font-medium ${
                view === "map"
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              Map
            </button>
          </div>

          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden w-fit">
            <button
              onClick={() => setDensityChoice("compact")}
              aria-label="Compact view"
              title="Compact view"
              className={`px-3 py-2 text-sm font-medium ${
                density === "compact"
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              ☰
            </button>
            <button
              onClick={() => setDensityChoice("expanded")}
              aria-label="Expanded view"
              title="Expanded view"
              className={`px-3 py-2 text-sm font-medium ${
                density === "expanded"
                  ? "bg-teal-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              ▤
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <label htmlFor="sort-by" className="text-slate-500 dark:text-slate-400">
            Sort by
          </label>
          <select
            id="sort-by"
            value={shuffleSeed !== null ? "" : sortKey}
            onChange={(e) => {
              setShuffleSeed(null);
              setSortKey(e.target.value as SortKey);
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1"
          >
            {shuffleSeed !== null && (
              <option value="" disabled>
                Random
              </option>
            )}
            {SORT_OPTIONS.filter((opt) => opt.key !== "distance" || userLocation).map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setShuffleSeed(null);
              setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            }}
            aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 px-2 py-1"
          >
            {sortDir === "asc" ? "▲" : "▼"}
          </button>
          <button
            type="button"
            onClick={() => setShuffleSeed(Date.now())}
            aria-label="Randomise the order"
            title="Randomise the order"
            className={`rounded-lg border px-2 py-1 ${
              shuffleSeed !== null
                ? "border-teal-500 bg-teal-600 text-white"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400"
            }`}
          >
            🔀
          </button>
        </div>
      </div>

      <div
        ref={panelsRef}
        className={`flex flex-col lg:flex-row gap-6 lg:gap-0 flex-1 min-h-0 ${
          isDragging ? "select-none" : ""
        }`}
        style={{ "--list-w": `${listWidthPct}%` } as React.CSSProperties}
      >
        <div className="w-full lg:w-[var(--list-w)] lg:shrink-0 lg:min-w-0">
          <ActivityListPanel
            key={`${buildQuery(filters)}|${sortKey}|${sortDir}|${shuffleSeed ?? ""}`}
            activities={sortedActivities}
            loading={loading}
            activeId={activeId}
            listFocusId={listFocusId}
            hidden={view === "map"}
            compact={density === "compact"}
            onHover={setActiveId}
            onSelect={handleSelectFromList}
            onCategoryClick={(category) => setFilters({ ...filters, category })}
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize list and map panels"
          onPointerDown={() => setIsDragging(true)}
          className="hidden lg:flex w-3 shrink-0 cursor-col-resize items-center justify-center group"
        >
          <div
            className={`w-1 h-10 rounded-full transition-colors ${
              isDragging ? "bg-teal-500" : "bg-slate-300 dark:bg-slate-600 group-hover:bg-teal-400"
            }`}
          />
        </div>

        <div
          className={`w-full lg:flex-1 lg:min-w-0 h-[70vh] lg:h-auto lg:max-h-[calc(100vh-220px)] ${
            view === "list" ? "hidden lg:block" : ""
          }`}
        >
          <ActivityMap
            activities={sortedActivities}
            activeId={activeActivity?.id ?? null}
            focusId={focusId}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      </div>
    </div>
  );
}
