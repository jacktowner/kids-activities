import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange, formatPrice } from "@/lib/format";
import { DeleteActivityButton } from "@/components/admin/DeleteActivityButton";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

const SORT_KEYS = ["name", "date", "price", "subjects"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

const ORDER_BY_FIELD: Record<SortKey, string> = {
  name: "title",
  date: "startDate",
  price: "priceMin",
  subjects: "category",
};

type Props = {
  searchParams: Promise<{ sort?: string; dir?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const sort: SortKey = SORT_KEYS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : "date";
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";

  const activities = await prisma.activity.findMany({
    orderBy: { [ORDER_BY_FIELD[sort]]: dir },
  });

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Manage listings</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to site
          </Link>
          <LogoutButton />
          <Link
            href="/admin/new"
            className="rounded-lg bg-teal-600 text-white text-sm font-medium px-4 py-2 hover:bg-teal-700 transition"
          >
            + Add activity
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {activities.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No activities yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">{sortHeader("name", "Name")}</th>
                  <th className="px-4 py-3 font-semibold">{sortHeader("date", "Date")}</th>
                  <th className="px-4 py-3 font-semibold">{sortHeader("price", "Price")}</th>
                  <th className="px-4 py-3 font-semibold">{sortHeader("subjects", "Subjects")}</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 min-w-0 max-w-xs">
                      <p className="font-medium text-slate-900 truncate flex items-center gap-2">
                        {activity.featured && (
                          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            ★
                          </span>
                        )}
                        <span className="truncate">{activity.title}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {activity.venue}, {activity.borough} · Ages {activity.ageMin}–{activity.ageMax}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateRange(activity.startDate.toISOString(), activity.endDate.toISOString())}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatPrice(activity)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {activity.category}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/${activity.id}`}
                          className="text-sm text-teal-700 hover:text-teal-900 font-medium"
                        >
                          Edit
                        </Link>
                        <DeleteActivityButton id={activity.id} title={activity.title} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
