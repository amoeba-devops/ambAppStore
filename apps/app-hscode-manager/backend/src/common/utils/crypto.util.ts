import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * 비밀 설정값(API 키 등) AES-256-GCM 암복호화 (POL-005).
 * 키는 SETTINGS_ENC_KEY 환경변수(권장 32바이트)에서 파생.
 */
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const secret = process.env.SETTINGS_ENC_KEY || process.env.JWT_SECRET || 'dev-fallback-key';
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return '';
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** 마스킹: 끝 4자만 노출 (예: ••••3015) */
export function maskSecret(plain: string): string {
  if (!plain) return '';
  const tail = plain.slice(-4);
  return `••••${tail}`;
}
