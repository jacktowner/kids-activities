"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublishActivityButton } from "@/components/admin/PublishActivityButton";
import { DeleteActivityButton } from "@/components/admin/DeleteActivityButton";
import type { ActivityStatus } from "@/types/activity";

export type AdminActivityRow = {
  id: string;
  title: string;
  featured: boolean;
  status: ActivityStatus;
  dateRange: string;
  price: string;
  category: string;
  venue: string;
  borough: string;
  ageMin: number;
  ageMax: number;
};

type SortKey = "name" | "date" | "price" | "subjects";
type SortDir = "asc" | "desc";

const STATUS_BADGE: Record<ActivityStatus, string> = {
  published: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-200 text-slate-700",
  expired: "bg-red-100 text-red-700",
};

type Props = {
  rows: AdminActivityRow[];
  sort: SortKey;
  dir: SortDir;
};

export function AdminActivitiesTable({ rows, sort, dir }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const router = useRouter();

  function sortHeader(key: SortKey, label: string) {
    const nextDir: SortDir = sort === key && dir === "asc" ? "desc" : "asc";
    return (
      <Link
        href={`/admin?sort=${key}&dir=${nextDir}`}
        className="flex items-center gap-1 hover:text-teal-700"
      >
        {label}
        {sort === key && (
          <span className="text-teal-600">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </Link>
    );
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function bulkAction(action: "publish" | "delete") {
    if (
      action === "delete" &&
      !confirm(`Delete ${selected.size} ${selected.size === 1 ? "activity" : "activities"}? This can't be undone.`)
    ) {
      return;
    }

    const ids = [...selected];
    setBulkLoading(true);
    const results = await Promise.all(
      ids.map((id) =>
        action === "publish"
          ? fetch(`/api/activities/${id}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "published" }),
            })
          : fetch(`/api/activities/${id}`, { method: "DELETE" })
      )
    );
    setBulkLoading(false);
    setSelected(new Set());
    router.refresh();

    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      alert(`${failed} of ${ids.length} ${action === "publish" ? "publishes" : "deletes"} failed.`);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <p className="p-6 text-sm text-slate-400 text-center">No activities yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {selected.size > 0 && (
        <div className="flex items-center gap-4 border-b border-slate-100 bg-teal-50 px-4 py-2 text-sm">
          <span className="font-medium text-teal-900">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => bulkAction("publish")}
            disabled={bulkLoading}
            className="text-teal-700 hover:text-teal-900 font-medium disabled:opacity-50"
          >
            Publish
          </button>
          <button
            type="button"
            onClick={() => bulkAction("delete")}
            disabled={bulkLoading}
            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-slate-500 hover:text-slate-700"
          >
            Clear selection
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selected.size === rows.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length;
                  }}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3 font-semibold">{sortHeader("name", "Name")}</th>
              <th className="px-4 py-3 font-semibold">{sortHeader("date", "Date")}</th>
              <th className="px-4 py-3 font-semibold">{sortHeader("price", "Price")}</th>
              <th className="px-4 py-3 font-semibold">{sortHeader("subjects", "Subjects")}</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className={`hover:bg-slate-50 ${selected.has(row.id) ? "bg-teal-50/60" : ""}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.title}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    className="rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3 min-w-0 max-w-xs">
                  <p className="font-medium text-slate-900 truncate flex items-center gap-2">
                    {row.featured && (
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        ★
                      </span>
                    )}
                    {row.status !== "published" && (
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[row.status]}`}
                      >
                        {row.status}
                      </span>
                    )}
                    <span className="truncate">{row.title}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {row.venue}, {row.borough} · Ages {row.ageMin}–{row.ageMax}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.dateRange}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.price}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.category}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <PublishActivityButton id={row.id} status={row.status} />
                    <Link href={`/admin/${row.id}`} className="text-sm text-teal-700 hover:text-teal-900 font-medium">
                      Edit
                    </Link>
                    <DeleteActivityButton id={row.id} title={row.title} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
