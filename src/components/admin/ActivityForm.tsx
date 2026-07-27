"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Activity } from "@/types/activity";
import { parseCategories } from "@/lib/category";

type Meta = { boroughs: string[]; categories: string[] };

type Props = {
  activity?: Activity;
  hideFeatured?: boolean;
  redirectTo?: string;
};

function toDateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function toPriceInput(activity?: Activity) {
  if (!activity) return "0";
  return activity.priceMin === activity.priceMax
    ? String(activity.priceMin)
    : `${activity.priceMin}-${activity.priceMax}`;
}

function parsePriceInput(input: string): { priceMin: number; priceMax: number } {
  const range = input.split("-").map((part) => Number(part.trim()));
  if (range.length === 2 && range.every((n) => !Number.isNaN(n))) {
    return { priceMin: range[0], priceMax: range[1] };
  }
  const value = Number(input) || 0;
  return { priceMin: value, priceMax: value };
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function ActivityForm({ activity, hideFeatured = false, redirectTo = "/admin" }: Props) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: activity?.title ?? "",
    description: activity?.description ?? "",
    category: activity ? parseCategories(activity.category) : [],
    borough: activity?.borough ?? "",
    venue: activity?.venue ?? "",
    address: activity?.address ?? "",
    lat: activity ? String(activity.lat) : "",
    lng: activity ? String(activity.lng) : "",
    ageMin: activity ? String(activity.ageMin) : "4",
    ageMax: activity ? String(activity.ageMax) : "16",
    isFree: activity?.isFree ?? false,
    price: toPriceInput(activity),
    startDate: toDateInput(activity?.startDate ?? ""),
    endDate: toDateInput(activity?.endDate ?? ""),
    times: activity?.times ?? "",
    sourceName: activity?.sourceName ?? "",
    sourceUrl: activity?.sourceUrl ?? "",
    imageUrl: activity?.imageUrl ?? "",
    featured: activity?.featured ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [geocodeState, setGeocodeState] = useState<{
    status: "idle" | "loading" | "found" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);
  const coordsKnown = values.lat !== "" && values.lng !== "";

  useEffect(() => {
    fetch("/api/meta")
      .then((res) => res.json())
      .then(setMeta)
      .catch(() => setMeta({ boroughs: [], categories: [] }));
  }, []);

  const categoryOptions = Array.from(new Set([...(meta?.categories ?? []), ...values.category]));
  const boroughOptions =
    values.borough && !(meta?.boroughs ?? []).includes(values.borough)
      ? [...(meta?.boroughs ?? []), values.borough]
      : (meta?.boroughs ?? []);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleFindLocation() {
    if (!values.address.trim()) {
      setGeocodeState({ status: "error", message: "Enter an address first." });
      return;
    }
    setGeocodeState({ status: "loading", message: "" });
    const query = [values.address, values.venue, values.borough, "London"].filter(Boolean).join(", ");
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      setGeocodeState({ status: "error", message: data.error ?? "Couldn't find that address." });
      return;
    }
    set("lat", String(data.lat));
    set("lng", String(data.lng));
    setShowManualCoords(false);
    setGeocodeState({ status: "found", message: data.displayName });
  }

  async function handleImageUpload(file: File) {
    setUploadError(null);

    if (file.size > 1 * 1024 * 1024) {
      setUploadError("Image must be under 1MB.");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();

    setUploading(false);
    if (!res.ok) {
      setUploadError(data.error ?? "Failed to upload image.");
      return;
    }
    set("imageUrl", data.url);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!coordsKnown) {
      setError("Find or enter a location before saving.");
      return;
    }
    if (values.category.length === 0) {
      setError("Select at least one category.");
      return;
    }
    setSaving(true);
    setError(null);

    const { price, ...rest } = values;
    const payload = {
      ...rest,
      lat: Number(values.lat),
      lng: Number(values.lng),
      ageMin: Number(values.ageMin),
      ageMax: Number(values.ageMax),
      ...(values.isFree ? { priceMin: 0, priceMax: 0 } : parsePriceInput(price)),
      ...(hideFeatured ? { featured: false } : {}),
    };

    const res = await fetch(activity ? `/api/activities/${activity.id}` : "/api/activities", {
      method: activity ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      setError("Failed to save activity.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Title" required>
          <input
            required
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Category" required>
          <details className="group relative">
            <summary
              className={`${inputClass} list-none cursor-pointer flex items-center justify-between gap-2`}
            >
              <span>
                {values.category.length === 0
                  ? "Select categories"
                  : values.category.length === 1
                    ? values.category[0]
                    : `${values.category.length} categories selected`}
              </span>
              <span className="text-xs transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg p-2 space-y-0.5">
              {categoryOptions.length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-0.5">Loading categories…</p>
              )}
              {categoryOptions.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 text-sm text-slate-700 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={values.category.includes(c)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...values.category, c]
                        : values.category.filter((x) => x !== c);
                      set("category", next);
                    }}
                    className="accent-teal-600 h-4 w-4"
                  />
                  {c}
                </label>
              ))}
            </div>
          </details>
        </Field>
      </div>

      <Field label="Description" required>
        <textarea
          required
          rows={3}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Venue" required>
          <input
            required
            value={values.venue}
            onChange={(e) => set("venue", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Borough" required>
          <select
            required
            value={values.borough}
            onChange={(e) => set("borough", e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a borough
            </option>
            {boroughOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Address" required>
        <div className="flex gap-2">
          <input
            required
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={handleFindLocation}
            disabled={geocodeState.status === "loading"}
            className="shrink-0 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-3 py-2 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {geocodeState.status === "loading" ? "Finding…" : "📍 Find location"}
          </button>
        </div>
      </Field>

      {geocodeState.status === "found" && (
        <p className="text-xs text-emerald-700 -mt-4">Found: {geocodeState.message}</p>
      )}
      {geocodeState.status === "error" && (
        <p className="text-xs text-red-600 -mt-4">{geocodeState.message}</p>
      )}

      {coordsKnown && !showManualCoords && (
        <p className="text-xs text-slate-500 -mt-4">
          Coordinates: {values.lat}, {values.lng} ·{" "}
          <button
            type="button"
            onClick={() => setShowManualCoords(true)}
            className="underline hover:text-slate-700"
          >
            Adjust manually
          </button>
        </p>
      )}

      {(showManualCoords || !coordsKnown) && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude" required>
            <input
              required
              type="number"
              step="any"
              value={values.lat}
              onChange={(e) => set("lat", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Longitude" required>
            <input
              required
              type="number"
              step="any"
              value={values.lng}
              onChange={(e) => set("lng", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Min age" required>
          <input
            required
            type="number"
            min={0}
            max={18}
            value={values.ageMin}
            onChange={(e) => set("ageMin", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Max age" required>
          <input
            required
            type="number"
            min={0}
            max={18}
            value={values.ageMax}
            onChange={(e) => set("ageMax", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" required>
          <input
            required
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="End date" required>
          <input
            required
            type="date"
            value={values.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Times (optional)">
        <input
          value={values.times}
          onChange={(e) => set("times", e.target.value)}
          placeholder="e.g. 10am–3pm"
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isFree}
            onChange={(e) => set("isFree", e.target.checked)}
          />
          Free activity
        </label>
        {!hideFeatured && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={values.featured}
              onChange={(e) => set("featured", e.target.checked)}
            />
            ★ Featured (shows at the top of the list)
          </label>
        )}
      </div>

      {!values.isFree && (
        <Field label="Price (£)">
          <input
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="e.g. 5 or 5-10 for a range"
            className={inputClass}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Source name (optional)">
          <input
            value={values.sourceName}
            onChange={(e) => set("sourceName", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Source URL (optional)">
          <input
            type="url"
            value={values.sourceUrl}
            onChange={(e) => set("sourceUrl", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Image (optional)">
        <div className="space-y-3">
          {values.imageUrl && (
            <div className="relative w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.imageUrl}
                alt=""
                className="w-48 h-32 object-cover rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={() => set("imageUrl", "")}
                className="absolute -top-2 -right-2 bg-white border border-slate-300 rounded-full w-6 h-6 text-xs text-slate-600 hover:bg-slate-50 shadow-sm"
              >
                ✕
              </button>
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          />
          {uploading && <p className="text-xs text-slate-500">Uploading…</p>}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 text-white text-sm font-medium px-5 py-2 hover:bg-teal-700 transition disabled:opacity-50"
        >
          {saving ? "Saving…" : activity ? "Save changes" : "Create activity"}
        </button>
        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium px-5 py-2 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
