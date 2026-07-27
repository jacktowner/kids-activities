"use client";

import { useRouter } from "next/navigation";

type Props = {
  endpoint?: string;
  redirectTo?: string;
};

export function LogoutButton({ endpoint = "/api/admin/logout", redirectTo = "/admin/login" }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch(endpoint, { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-sm text-slate-500 hover:text-slate-700"
    >
      Log out
    </button>
  );
}
