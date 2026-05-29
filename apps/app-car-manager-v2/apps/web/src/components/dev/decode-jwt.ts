import { decodeJwt } from 'jose';

/**
 * Decode a JWT payload WITHOUT signature verification. Dev panel only.
 *
 * Server-side verification (signature, schema) happens in middleware via
 * `verifyAmaJwt()`. This util is purely for surfacing the already-trusted
 * claims back to the panel UI.
 *
 * Returns null on malformed input rather than throwing — the panel renders a
 * graceful "decode failed" state.
 */
export interface DecodedAmaJwt {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  entityId?: string;
  appCode?: string;
  appId?: string;
  scope?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function safeDecodeJwt(token: string): DecodedAmaJwt | null {
  try {
    return decodeJwt(token) as DecodedAmaJwt;
  } catch {
    return null;
  }
}
