import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ActivityForm } from "@/components/admin/ActivityForm";
import { USER_SESSION_COOKIE, getSessionUser } from "@/lib/user-auth";

export default async function NewListingPage() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(USER_SESSION_COOKIE)?.value);
  if (!user) redirect("/account/login");

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">Add a listing</h1>
      <ActivityForm hideFeatured redirectTo="/account" />
    </div>
  );
}
