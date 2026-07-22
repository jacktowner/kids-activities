import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [boroughs, categories, priceAgg] = await Promise.all([
    prisma.activity.findMany({ distinct: ["borough"], select: { borough: true }, orderBy: { borough: "asc" } }),
    prisma.activity.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    prisma.activity.aggregate({ _max: { priceMax: true } }),
  ]);

  return NextResponse.json({
    boroughs: boroughs.map((b) => b.borough),
    categories: categories.map((c) => c.category),
    maxPrice: Math.ceil(priceAgg._max.priceMax ?? 0),
  });
}
