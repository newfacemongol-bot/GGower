import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from './prisma';

const SESSION_COOKIE = 'chatbot_session';
const SESSION_DAYS = 7;

export async function createSession(role: 'admin' | 'operator'): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.adminSession.create({ data: { token, role, expiresAt } });
  return token;
}

export async function getSession(): Promise<{ role: string } | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;
  return { role: session.role };
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({ where: { token } }).catch(() => {});
  }
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie() {
  cookies().delete(SESSION_COOKIE);
}

export function verifyPassword(input: string, role: 'admin' | 'operator'): boolean {
  const adminPw = process.env.ADMIN_PASSWORD || '';
  const operatorPw = process.env.OPERATOR_PASSWORD || adminPw;
  if (role === 'admin') return !!input && input === adminPw;
  return !!input && (input === operatorPw || input === adminPw);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
