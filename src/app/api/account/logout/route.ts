import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { USER_SESSION_COOKIE, deleteSession } from "@/lib/user-auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(USER_SESSION_COOKIE)?.value;
  await deleteSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(USER_SESSION_COOKIE);
  return response;
}
