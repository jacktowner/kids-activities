import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { parseCategories } from "@/lib/category";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Public, unauthenticated, read-only mirror of /api/activities: a stable contract for
// third parties, so the internal endpoint (used by the site's own explore page) stays
// free to change shape without breaking external consumers. Never exposes ownerId,
// status, createdAt or updatedAt.
const PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  borough: true,
  venue: true,
  address: true,
  lat: true,
  lng: true,
  ageMin: true,
  ageMax: true,
  isFree: true,
  priceMin: true,
  priceMax: true,
  startDate: true,
  endDate: true,
  times: true,
  sourceName: true,
  sourceUrl: true,
  imageUrl: true,
  featured: true,
} satisfies Prisma.ActivitySelect;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const q = params.get("q")?.trim();
  const boroughs = params
    .get("borough")
    ?.split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  const category = params.get("category")?.trim();
  const age = params.get("age") ? Number(params.get("age")) : undefined;
  const freeOnly = params.get("freeOnly") === "true";
  const priceMax = params.get("priceMax") ? Number(params.get("priceMax")) : undefined;
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  const rawLimit = params.get("limit") ? Number(params.get("limit")) : DEFAULT_LIMIT;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : DEFAULT_LIMIT)
  );
  const rawOffset = params.get("offset") ? Number(params.get("offset")) : 0;
  const offset = Math.max(0, Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0);

  const where: Prisma.ActivityWhereInput = { status: "published" };

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { venue: { contains: q } },
    ];
  }

  if (boroughs && boroughs.length > 0) where.borough = { in: boroughs };
  if (category) where.category = { contains: category };

  if (typeof age === "number" && !Number.isNaN(age)) {
    where.ageMin = { lte: age };
    where.ageMax = { gte: age };
  }

  if (freeOnly) {
    where.isFree = true;
  } else if (typeof priceMax === "number" && !Number.isNaN(priceMax)) {
    where.priceMin = { lte: priceMax };
  }

  where.AND = [
    { endDate: { gte: new Date(new Date().toDateString()) } },
    ...(dateTo ? [{ startDate: { lte: new Date(dateTo) } }] : []),
    ...(dateFrom ? [{ endDate: { gte: new Date(dateFrom) } }] : []),
  ];

  const rows = await prisma.activity.findMany({
    where,
    select: PUBLIC_SELECT,
    orderBy: [{ featured: "desc" }, { startDate: "asc" }],
  });

  const filtered = category
    ? rows.filter((a) => parseCategories(a.category).includes(category))
    : rows;

  const page = filtered.slice(offset, offset + limit);

  return NextResponse.json(
    {
      activities: page,
      total: filtered.length,
      limit,
      offset,
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
