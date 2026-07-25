"use client";

import { useState } from "react";
import type { ActivityFilters } from "@/types/activity";

type Meta = {
  boroughs: string[];
  categories: string[];
  maxPrice: number;
};

type Props = {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  meta: Meta | null;
  resultCount: number;
};

const DATE_PRESETS = [
  { label: "Any date", from: undefined, to: undefined },
  { label: "Summer holidays 2026", from: "2026-07-22", to: "2026-09-01" },
  { label: "October half term 2026", from: "2026-10-26", to: "2026-11-01" },
];

export function FilterPanel({ filters, onChange, meta, resultCount }: Props) {
  const [expanded, setExpanded] = useState(false);

  function set<K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({});
  }

  const activePreset = DATE_PRESETS.find(
    (p) => p.from === filters.dateFrom && p.to === filters.dateTo
  );

  const advancedActiveCount = [filters.freeOnly || filters.priceMax !== undefined].filter(
    Boolean
  ).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 shadow-sm space-y-1.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50">Filter activities</h2>
        <button
          onClick={reset}
          className="text-sm text-teal-700 hover:text-teal-900 underline underline-offset-2"
        >
          Clear all
        </button>
      </div>

      {/* Primary filters: when + where, given equal top billing since these narrow results the most */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[260px] rounded-lg border-2 border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 p-3">
          <label className="flex items-center gap-1 text-sm font-semibold text-teal-800 dark:text-teal-300 mb-1">
            📅 When
          </label>
          <select
            value={activePreset ? activePreset.label : "custom"}
            onChange={(e) => {
              const preset = DATE_PRESETS.find((p) => p.label === e.target.value);
              if (preset) {
                onChange({ ...filters, dateFrom: preset.from, dateTo: preset.to });
              }
            }}
            className="w-full rounded-lg border border-teal-400 dark:border-teal-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm font-medium mb-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom range</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={(e) => set("dateFrom", e.target.value || undefined)}
              className="w-1/2 rounded-lg border border-teal-400 dark:border-teal-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={(e) => set("dateTo", e.target.value || undefined)}
              className="w-1/2 rounded-lg border border-teal-400 dark:border-teal-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex-1 min-w-[260px] rounded-lg border-2 border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 p-3">
          <label className="flex items-center gap-1 text-sm font-semibold text-teal-800 dark:text-teal-300 mb-1">
            📍 Where
          </label>
          <details className="group relative">
            <summary className="w-full list-none cursor-pointer rounded-lg border border-teal-400 dark:border-teal-600 dark:bg-slate-900 dark:text-slate-100 px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center justify-between">
              <span>
                {!filters.borough || filters.borough.length === 0
                  ? "All boroughs"
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
        </div>
      </div>

      {/* Secondary refinements: free-text search + age */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-0.5">Search</label>
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

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-900 pb-1"
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
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
            <input
              type="checkbox"
              checked={filters.freeOnly ?? false}
              onChange={(e) => set("freeOnly", e.target.checked || undefined)}
              className="accent-teal-600 h-4 w-4"
            />
            Free activities only
          </label>
          {!filters.freeOnly && (
            <div className="flex-1 min-w-[240px] flex items-center gap-2">
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

      <p className="text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-1.5">
        {resultCount} {resultCount === 1 ? "activity" : "activities"} found
      </p>
    </div>
  );
}
