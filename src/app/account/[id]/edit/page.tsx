import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ActivityForm } from "@/components/admin/ActivityForm";
import { USER_SESSION_COOKIE, getSessionUser } from "@/lib/user-auth";

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(USER_SESSION_COOKIE)?.value);
  if (!user) redirect("/account/login");

  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity || activity.ownerId !== user.id) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">Edit listing</h1>
      <ActivityForm
        activity={{
          ...activity,
          startDate: activity.startDate.toISOString(),
          endDate: activity.endDate.toISOString(),
        }}
        hideFeatured
        redirectTo="/account"
      />
    </div>
  );
}
