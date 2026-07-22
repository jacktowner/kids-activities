"use client";

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
  function set<K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function reset() {
    onChange({});
  }

  const activePreset = DATE_PRESETS.find(
    (p) => p.from === filters.dateFrom && p.to === filters.dateTo
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Filter activities</h2>
        <button
          onClick={reset}
          className="text-sm text-teal-700 hover:text-teal-900 underline underline-offset-2"
        >
          Clear all
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Search
        </label>
        <input
          type="text"
          placeholder="e.g. football, art, park name..."
          value={filters.q ?? ""}
          onChange={(e) => set("q", e.target.value || undefined)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Child&apos;s age: {filters.age ?? "any"}
        </label>
        <input
          type="range"
          min={4}
          max={16}
          value={filters.age ?? 10}
          onChange={(e) => set("age", Number(e.target.value))}
          className="w-full accent-teal-600"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>4</span>
          <span>16</span>
        </div>
        {filters.age !== undefined && (
          <button
            onClick={() => set("age", undefined)}
            className="mt-1 text-xs text-teal-700 underline underline-offset-2"
          >
            Reset age
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">When</label>
        <select
          value={activePreset ? activePreset.label : "custom"}
          onChange={(e) => {
            const preset = DATE_PRESETS.find((p) => p.label === e.target.value);
            if (preset) {
              onChange({ ...filters, dateFrom: preset.from, dateTo: preset.to });
            }
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            className="w-1/2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => set("dateTo", e.target.value || undefined)}
            className="w-1/2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
          <input
            type="checkbox"
            checked={filters.freeOnly ?? false}
            onChange={(e) => set("freeOnly", e.target.checked || undefined)}
            className="accent-teal-600 h-4 w-4"
          />
          Free activities only
        </label>
        {!filters.freeOnly && (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Max price: {filters.priceMax !== undefined ? `£${filters.priceMax}` : "any"}
            </label>
            <input
              type="range"
              min={0}
              max={meta?.maxPrice ?? 50}
              value={filters.priceMax ?? meta?.maxPrice ?? 50}
              onChange={(e) => set("priceMax", Number(e.target.value))}
              className="w-full accent-teal-600"
            />
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Borough</label>
        <select
          value={filters.borough ?? ""}
          onChange={(e) => set("borough", e.target.value || undefined)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All boroughs</option>
          {meta?.boroughs.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
        <select
          value={filters.category ?? ""}
          onChange={(e) => set("category", e.target.value || undefined)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All categories</option>
          {meta?.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-slate-500 border-t border-slate-100 pt-3">
        {resultCount} {resultCount === 1 ? "activity" : "activities"} found
      </p>
    </div>
  );
}
