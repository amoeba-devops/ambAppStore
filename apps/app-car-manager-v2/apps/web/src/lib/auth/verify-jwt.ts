import { jwtVerify } from 'jose';
import { amaJwtClaimsSchema, type AmaJwtClaims } from '@car-v2/shared/auth';

let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export async function verifyAmaJwt(token: string): Promise<AmaJwtClaims> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: 'amb-management',
    audience: 'car-manager-v2',
  });
  return amaJwtClaimsSchema.parse(payload);
}
