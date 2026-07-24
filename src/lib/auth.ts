import { createHash, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "admin_session";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function sessionToken(): string {
  const password = process.env.ADMIN_PASSWORD ?? "";
  return createHash("sha256").update(password).digest("hex");
}

export function checkPassword(password: string): boolean {
  return safeEqual(password, process.env.ADMIN_PASSWORD ?? "");
}

export function isValidSessionCookie(value: string | undefined | null): boolean {
  if (!value) return false;
  return safeEqual(value, sessionToken());
}
