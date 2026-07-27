import { randomBytes, timingSafeEqual, scrypt } from "crypto";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";

const scryptAsync = promisify(scrypt);

export const USER_SESSION_COOKIE = "user_session";

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days, matches admin cookie maxAge

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return { hash: derived.toString("hex"), salt };
}

export async function verifyPassword(
  password: string,
  salt: string,
  hash: string
): Promise<boolean> {
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return safeEqual(derived.toString("hex"), hash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function getSessionUser(
  token: string | undefined | null
): Promise<{ id: string; email: string } | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return { id: session.user.id, email: session.user.email };
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}
