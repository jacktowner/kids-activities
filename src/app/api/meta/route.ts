import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCategories } from "@/lib/category";

export async function GET() {
  const [boroughs, categoryRows, priceAgg] = await Promise.all([
    prisma.activity.findMany({ distinct: ["borough"], select: { borough: true }, orderBy: { borough: "asc" } }),
    prisma.activity.findMany({ select: { category: true } }),
    prisma.activity.aggregate({ _max: { priceMax: true } }),
  ]);

  const counts = new Map<string, number>();
  for (const row of categoryRows) {
    for (const category of parseCategories(row.category)) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  const categoryCounts = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, count]) => ({ category, count }));

  return NextResponse.json({
    boroughs: boroughs.map((b) => b.borough),
    categories: categoryCounts.map((c) => c.category),
    categoryCounts,
    maxPrice: Math.ceil(priceAgg._max.priceMax ?? 0),
  });
}
