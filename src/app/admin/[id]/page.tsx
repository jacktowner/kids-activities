import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ActivityForm } from "@/components/admin/ActivityForm";
import type { ActivityStatus } from "@/types/activity";

type Props = { params: Promise<{ id: string }> };

export default async function EditActivityPage({ params }: Props) {
  const { id } = await params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Edit activity</h1>
      <ActivityForm
        activity={{
          ...activity,
          startDate: activity.startDate.toISOString(),
          endDate: activity.endDate.toISOString(),
          status: activity.status as ActivityStatus,
        }}
      />
    </div>
  );
}
