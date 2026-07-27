import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  USER_SESSION_COOKIE,
  normalizeEmail,
  hashPassword,
  createSession,
} from "@/lib/user-auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const { hash, salt } = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash: hash, passwordSalt: salt },
  });

  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true }, { status: 201 });
  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
