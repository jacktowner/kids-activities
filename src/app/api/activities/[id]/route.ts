import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { toActivityData } from "@/lib/activity-input";
import { resolveActor } from "@/lib/request-actor";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(activity);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const actor = await resolveActor(request);
  if (actor.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data = toActivityData(body);
  if (actor.kind === "user") {
    data.featured = false;
  }

  try {
    const activity = await prisma.activity.update({
      where: {
        id,
        ...(actor.kind === "admin" ? {} : { ownerId: actor.id }),
      },
      data,
    });
    return NextResponse.json(activity);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const actor = await resolveActor(request);
  if (actor.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await prisma.activity.delete({
      where: {
        id,
        ...(actor.kind === "admin" ? {} : { ownerId: actor.id }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
