import Link from "next/link";

export function AccountNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) {
    return (
      <Link
        href="/account"
        className="text-sm font-medium text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300"
      >
        My listings
      </Link>
    );
  }

  return (
    <Link
      href="/account/login"
      className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400"
    >
      Sign in
    </Link>
  );
}
