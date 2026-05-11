import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export type MobileJwtPayload = {
  sub: string;
  role: 'ADMIN' | 'MANAGER' | 'DRIVER';
  language: 'en' | 'ko' | 'vi';
};

export async function signAccessToken(payload: MobileJwtPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .setIssuer('company-car-mobile')
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<MobileJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'company-car-mobile',
    });
    return payload as MobileJwtPayload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
