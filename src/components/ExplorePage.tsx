"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/FilterPanel";
import { ActivityCard } from "@/components/ActivityCard";
import type { Activity, ActivityFilters } from "@/types/activity";

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((mod) => mod.ActivityMap),
  { ssr: false, loading: () => <MapPlaceholder /> }
);

function MapPlaceholder() {
  return (
    <div className="h-full w-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
      Loading map…
    </div>
  );
}

type Meta = {
  boroughs: string[];
  categories: string[];
  maxPrice: number;
};

function buildQuery(filters: ActivityFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.borough) params.set("borough", filters.borough);
  if (filters.category) params.set("category", filters.category);
  if (filters.age !== undefined) params.set("age", String(filters.age));
  if (filters.freeOnly) params.set("freeOnly", "true");
  if (!filters.freeOnly && filters.priceMax !== undefined)
    params.set("priceMax", String(filters.priceMax));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params.toString();
}

export function ExplorePage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta({ boroughs: [], categories: [], maxPrice: 50 }));
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
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          South London Kids Activities
        </h1>
        <p className="text-slate-600 text-sm sm:text-base">
          Holiday clubs, camps and drop-in activities for ages 4–16, curated from council,
          museum and local organiser listings across South London.
        </p>
      </header>

      <div className="lg:hidden flex rounded-lg border border-slate-200 overflow-hidden w-fit">
        <button
          onClick={() => setView("list")}
          className={`px-4 py-2 text-sm font-medium ${
            view === "list" ? "bg-teal-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView("map")}
          className={`px-4 py-2 text-sm font-medium ${
            view === "map" ? "bg-teal-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          Map
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_1fr] gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            meta={meta}
            resultCount={activities.length}
          />
        </div>

        <div
          className={`lg:col-span-1 space-y-3 overflow-y-auto max-h-[70vh] lg:max-h-[calc(100vh-220px)] pr-1 ${
            view === "map" ? "hidden lg:block" : ""
          }`}
        >
          {loading && (
            <p className="text-sm text-slate-400 py-8 text-center">Loading activities…</p>
          )}
          {!loading && activities.length === 0 && (
            <p className="text-sm text-slate-400 py-8 text-center">
              No activities match your filters. Try widening your search.
            </p>
          )}
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              isActive={activity.id === activeId}
              onHover={setActiveId}
              onSelect={(id) => setActiveId(id)}
            />
          ))}
        </div>

        <div
          className={`lg:col-span-1 h-[70vh] lg:h-auto lg:max-h-[calc(100vh-220px)] ${
            view === "list" ? "hidden lg:block" : ""
          }`}
        >
          <ActivityMap
            activities={activities}
            activeId={activeActivity?.id ?? null}
            onMarkerClick={setActiveId}
            onViewInList={handleSelectFromMap}
          />
        </div>
      </div>
    </div>
  );
}
