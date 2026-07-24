"use client";

type CategoryCount = {
  category: string;
  count: number;
};

type Props = {
  categories: CategoryCount[];
  selected?: string;
  onSelect: (category: string | undefined) => void;
};

const ICONS: Record<string, string> = {
  Sports: "⚽",
  "Arts & Crafts": "🎨",
  Nature: "🌳",
  "Museum & Heritage": "🏛️",
  STEM: "💡",
  "Multi-activity Camp": "🏕️",
  "Music & Drama": "🎭",
};

function pillClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "bg-teal-600 text-white"
      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
  }`;
}

export function CategoryNav({ categories, selected, onSelect }: Props) {
  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <nav
      aria-label="Browse by category"
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm"
    >
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onSelect(undefined)} className={pillClass(!selected)}>
          All <span className="opacity-70">({total})</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            onClick={() => onSelect(selected === c.category ? undefined : c.category)}
            className={pillClass(selected === c.category)}
          >
            <span>{ICONS[c.category] ?? "🔸"}</span>
            {c.category} <span className="opacity-70">({c.count})</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
