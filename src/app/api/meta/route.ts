import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [boroughs, categoryCounts, priceAgg] = await Promise.all([
    prisma.activity.findMany({ distinct: ["borough"], select: { borough: true }, orderBy: { borough: "asc" } }),
    prisma.activity.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { category: "asc" } }),
    prisma.activity.aggregate({ _max: { priceMax: true } }),
  ]);

  return NextResponse.json({
    boroughs: boroughs.map((b) => b.borough),
    categories: categoryCounts.map((c) => c.category),
    categoryCounts: categoryCounts.map((c) => ({ category: c.category, count: c._count._all })),
    maxPrice: Math.ceil(priceAgg._max.priceMax ?? 0),
  });
}
