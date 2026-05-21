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
  // No `issuer`/`audience` options: AMA's `generateAppToken` does not include
  // `iss`/`aud` claims. Identity binding is enforced by (a) shared HS256 secret
  // and (b) the schema's `appCode` literal check.
  const { payload } = await jwtVerify(token, getSecret());
  return amaJwtClaimsSchema.parse(payload);
}
