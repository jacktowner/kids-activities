import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { resolveActor } from "@/lib/request-actor";
import type { ActivityStatus } from "@/types/activity";

const ALLOWED_STATUSES: ActivityStatus[] = ["draft", "published", "expired"];

type Ctx = { params: Promise<{ id: string }> };

// Lightweight sibling to PATCH /api/activities/[id]: that route always rebuilds the
// full record from toActivityData(), so a quick "Publish this draft" action from the
// admin table can't use it without re-sending every field. This route only ever
// touches `status`.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const actor = await resolveActor(request);
  if (actor.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const activity = await prisma.activity.update({
      where: {
        id,
        ...(actor.kind === "admin" ? {} : { ownerId: actor.id }),
      },
      data: { status },
    });
    return NextResponse.json(activity);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
