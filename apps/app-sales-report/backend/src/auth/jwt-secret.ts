/**
 * JWT 서명 비밀값. 기본값으로 대체하지 않는다 — 미설정이면 부팅을 멈춘다 (FIX-261120).
 * 기본값이 있으면 env 누락 시 누구나 아는 값으로 토큰이 위조될 수 있다.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET is required (min 16 chars)');
  }
  return secret;
}
