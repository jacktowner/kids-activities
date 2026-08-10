import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="max-w-7xl mx-auto px-4 py-6 w-full text-center text-xs text-slate-400 dark:text-slate-500">
      <Link href="/api-docs" className="hover:text-teal-700 dark:hover:text-teal-400 hover:underline">
        API
      </Link>
    </footer>
  );
}
