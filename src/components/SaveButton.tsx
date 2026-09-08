"use client";

import { useShortlist } from "@/lib/shortlist";

export function SaveButton({ id }: { id: string }) {
  const { has, toggle } = useShortlist();
  const saved = has(id);

  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={saved}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
        saved
          ? "border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-300"
          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400 hover:text-teal-700 dark:hover:text-teal-400"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
      </svg>
      {saved ? "Saved to shortlist" : "Save to shortlist"}
    </button>
  );
}
