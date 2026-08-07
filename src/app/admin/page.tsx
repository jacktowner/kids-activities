import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateRange, formatPrice } from "@/lib/format";
import { AdminActivitiesTable, type AdminActivityRow } from "@/components/admin/AdminActivitiesTable";
import { LogoutButton } from "@/components/admin/LogoutButton";
import type { ActivityStatus } from "@/types/activity";

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

const STATUS_TABS = ["all", "published", "draft", "expired"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

type Props = {
  searchParams: Promise<{ sort?: string; dir?: string; status?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const sort: SortKey = SORT_KEYS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : "date";
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const statusTab: StatusTab = STATUS_TABS.includes(params.status as StatusTab)
    ? (params.status as StatusTab)
    : "all";

  const [activities, statusCounts] = await Promise.all([
    prisma.activity.findMany({
      where: statusTab === "all" ? {} : { status: statusTab },
      orderBy: { [ORDER_BY_FIELD[sort]]: dir },
    }),
    prisma.activity.groupBy({ by: ["status"], _count: true }),
  ]);
  const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count]));
  const totalCount = statusCounts.reduce((sum, s) => sum + s._count, 0);

  const rows: AdminActivityRow[] = activities.map((activity) => ({
    id: activity.id,
    title: activity.title,
    featured: activity.featured,
    status: activity.status as ActivityStatus,
    dateRange: formatDateRange(activity.startDate.toISOString(), activity.endDate.toISOString()),
    price: formatPrice(activity),
    category: activity.category,
    venue: activity.venue,
    borough: activity.borough,
    ageMin: activity.ageMin,
    ageMax: activity.ageMax,
  }));

  function statusHref(tab: StatusTab) {
    const qs = new URLSearchParams({ sort, dir });
    if (tab !== "all") qs.set("status", tab);
    return `/admin?${qs.toString()}`;
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

      <div className="flex items-center gap-2 text-sm">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={statusHref(tab)}
            className={`px-3 py-1.5 rounded-lg font-medium capitalize ${
              statusTab === tab
                ? "bg-teal-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab} ({tab === "all" ? totalCount : countByStatus.get(tab) ?? 0})
          </Link>
        ))}
      </div>

      <AdminActivitiesTable rows={rows} sort={sort} dir={dir} />
    </div>
  );
}
