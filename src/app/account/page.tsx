import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatDateRange, formatPrice } from "@/lib/format";
import { DeleteActivityButton } from "@/components/admin/DeleteActivityButton";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { USER_SESSION_COOKIE, getSessionUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(USER_SESSION_COOKIE)?.value);
  if (!user) redirect("/account/login");

  const activities = await prisma.activity.findMany({
    where: { ownerId: user.id },
    orderBy: { startDate: "asc" },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">My listings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            ← Back to site
          </Link>
          <LogoutButton endpoint="/api/account/logout" redirectTo="/account/login" />
          <Link
            href="/account/new"
            className="rounded-lg bg-teal-600 text-white text-sm font-medium px-4 py-2 hover:bg-teal-700 transition"
          >
            + Add listing
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {activities.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">
            You haven&apos;t submitted any listings yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-50 truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {activity.venue}, {activity.borough} ·{" "}
                    {formatDateRange(activity.startDate.toISOString(), activity.endDate.toISOString())} ·{" "}
                    {formatPrice(activity)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/account/${activity.id}/edit`}
                    className="text-sm text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 font-medium"
                  >
                    Edit
                  </Link>
                  <DeleteActivityButton id={activity.id} title={activity.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
