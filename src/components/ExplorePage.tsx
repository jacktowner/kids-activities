"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { ActivityCard } from "@/components/ActivityCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CategoryNav } from "@/components/CategoryNav";
import { AccountNav } from "@/components/AccountNav";
import type { Activity, ActivityFilters } from "@/types/activity";

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

type SortKey = "name" | "date" | "price" | "subjects";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "subjects", label: "Subjects" },
];

function sortActivities(activities: Activity[], sortKey: SortKey, sortDir: SortDir) {
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
    }
  });
  const withDir = sortDir === "desc" ? sorted.reverse() : sorted;
  // Featured activities always lead the list, regardless of sort — sort is stable
  // within each group so the chosen order still applies inside it.
  return [...withDir.filter((a) => a.featured), ...withDir.filter((a) => !a.featured)];
}

const PAGE_SIZE = 12;

type ActivityListPanelProps = {
  activities: Activity[];
  loading: boolean;
  activeId: string | null;
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
  const [view, setView] = useState<"list" | "map">("list");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [density, setDensity] = useState<"compact" | "expanded">("expanded");

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta({ boroughs: [], categories: [], categoryCounts: [], maxPrice: 50 }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const query = buildQuery(filters);
    fetch(`/api/activities${query ? `?${query}` : ""}`, { signal: controller.signal })
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
    () => sortActivities(activities, sortKey, sortDir),
    [activities, sortKey, sortDir]
  );

  function handleSelectFromList(id: string) {
    setActiveId(id);
    setFocusId(id);
    setView("map");
  }

  function handleMarkerClick(id: string) {
    setActiveId(id);
    setFocusId(id);
  }

  function handleSelectFromMap(id: string) {
    setActiveId(id);
    setView("list");
    requestAnimationFrame(() => {
      document.getElementById(`activity-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50">
            South London Kids Activities
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Holiday clubs, camps and drop-in activities for ages 4–16, curated from council,
            museum and local organiser listings across South London.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AccountNav isLoggedIn={isLoggedIn} />
          <ThemeToggle />
        </div>
      </header>

      <CategoryNav
        categories={meta?.categoryCounts ?? []}
        selected={filters.category}
        onSelect={(category) => setFilters({ ...filters, category })}
      />

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        meta={meta}
        resultCount={activities.length}
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
              onClick={() => setDensity("compact")}
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
              onClick={() => setDensity("expanded")}
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
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-1"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={sortDir === "asc" ? "Sort ascending" : "Sort descending"}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 px-2 py-1"
          >
            {sortDir === "asc" ? "▲" : "▼"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 flex-1 min-h-0">
        <ActivityListPanel
          key={`${buildQuery(filters)}|${sortKey}|${sortDir}`}
          activities={sortedActivities}
          loading={loading}
          activeId={activeId}
          hidden={view === "map"}
          compact={density === "compact"}
          onHover={setActiveId}
          onSelect={handleSelectFromList}
          onCategoryClick={(category) => setFilters({ ...filters, category })}
        />

        <div
          className={`h-[70vh] lg:h-auto lg:max-h-[calc(100vh-220px)] ${
            view === "list" ? "hidden lg:block" : ""
          }`}
        >
          <ActivityMap
            activities={sortedActivities}
            activeId={activeActivity?.id ?? null}
            focusId={focusId}
            onMarkerClick={handleMarkerClick}
            onViewInList={handleSelectFromMap}
          />
        </div>
      </div>
    </div>
  );
}
