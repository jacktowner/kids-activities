import type { Metadata } from "next";
import { ShortlistView } from "@/components/ShortlistView";

export const metadata: Metadata = {
  title: "Your shortlist | London Kids Activities",
  description: "The kids activities you've saved to look at later.",
};

export default function ShortlistPage() {
  return <ShortlistView />;
}
