import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { toActivityData } from "@/lib/activity-input";
import { resolveActor } from "@/lib/request-actor";

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

  const where: Prisma.ActivityWhereInput = {};

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { venue: { contains: q } },
    ];
  }

  if (boroughs && boroughs.length > 0) where.borough = { in: boroughs };
  if (category) where.category = category;

  if (typeof age === "number" && !Number.isNaN(age)) {
    where.ageMin = { lte: age };
    where.ageMax = { gte: age };
  }

  if (freeOnly) {
    where.isFree = true;
  } else if (typeof priceMax === "number" && !Number.isNaN(priceMax)) {
    where.priceMin = { lte: priceMax };
  }

  if (dateFrom || dateTo) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      ...(dateTo ? [{ startDate: { lte: new Date(dateTo) } }] : []),
      ...(dateFrom ? [{ endDate: { gte: new Date(dateFrom) } }] : []),
    ];
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: [{ featured: "desc" }, { startDate: "asc" }],
  });

  return NextResponse.json(activities);
}

export async function POST(request: NextRequest) {
  const actor = await resolveActor(request);
  if (actor.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data = toActivityData(body);
  if (actor.kind === "user") {
    data.featured = false;
    data.owner = { connect: { id: actor.id } };
  }

  const activity = await prisma.activity.create({ data });
  return NextResponse.json(activity, { status: 201 });
}
