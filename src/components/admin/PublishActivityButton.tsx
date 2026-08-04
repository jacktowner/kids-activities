"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityStatus } from "@/types/activity";

export function PublishActivityButton({ id, status }: { id: string; status: ActivityStatus }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (status === "published") return null;

  async function handlePublish() {
    setLoading(true);
    const res = await fetch(`/api/activities/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    setLoading(false);

    if (res.ok) {
      router.refresh();
    } else {
      alert("Failed to publish activity.");
    }
  }

  return (
    <button
      type="button"
      onClick={handlePublish}
      disabled={loading}
      className="text-sm text-teal-700 hover:text-teal-900 font-medium disabled:opacity-50"
    >
      {loading ? "Publishing…" : "Publish"}
    </button>
  );
}
