import { ActivityForm } from "@/components/admin/ActivityForm";

export default function NewActivityPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Add activity</h1>
      <ActivityForm />
    </div>
  );
}
