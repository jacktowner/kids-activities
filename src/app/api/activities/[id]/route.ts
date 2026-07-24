import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, isValidSessionCookie } from "@/lib/auth";
import { toActivityData } from "@/lib/activity-input";

type Ctx = { params: Promise<{ id: string }> };

function isAuthed(request: NextRequest) {
  return isValidSessionCookie(request.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(activity);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const activity = await prisma.activity.update({
    where: { id },
    data: toActivityData(body),
  });
  return NextResponse.json(activity);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  if (!isAuthed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.activity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
