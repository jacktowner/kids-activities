import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSessionCookie } from "@/lib/auth";
import { USER_SESSION_COOKIE, getSessionUser } from "@/lib/user-auth";

export type Actor =
  | { kind: "admin" }
  | { kind: "user"; id: string; email: string }
  | { kind: "none" };

export async function resolveActor(request: NextRequest): Promise<Actor> {
  if (isValidSessionCookie(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return { kind: "admin" };
  }
  const user = await getSessionUser(request.cookies.get(USER_SESSION_COOKIE)?.value);
  if (user) {
    return { kind: "user", id: user.id, email: user.email };
  }
  return { kind: "none" };
}
