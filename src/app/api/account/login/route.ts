import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  USER_SESSION_COOKIE,
  normalizeEmail,
  verifyPassword,
  createSession,
} from "@/lib/user-auth";

const GENERIC_ERROR = "Incorrect email or password";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
