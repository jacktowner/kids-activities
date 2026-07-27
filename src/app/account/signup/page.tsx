"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/account/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to create account");
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Create an account</h1>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-teal-600 text-white text-sm font-medium py-2 hover:bg-teal-700 transition disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Already have an account?{" "}
          <Link href="/account/login" className="text-teal-700 dark:text-teal-400 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
