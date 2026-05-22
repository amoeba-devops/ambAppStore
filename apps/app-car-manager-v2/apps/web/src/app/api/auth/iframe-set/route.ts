import { NextResponse, type NextRequest } from 'next/server';

/**
 * Option A — Iframe session keep-alive.
 *
 * AMA parent loads a hidden iframe pointing here với `?ama_token=<new>` mỗi
 * ~55 phút (trước JWT exp 1h). Middleware đã handle phần verify + set cookie
 * via redirect chain. Endpoint này chỉ cần trả 204 No Content sau khi cookie
 * đã set xong, để hidden iframe biết load done và unmount.
 *
 * Flow:
 *   1. Hidden iframe GET /api/auth/iframe-set?ama_token=NEW
 *   2. Middleware: verify token → set cookie amb_session → 307 → /api/auth/iframe-set
 *   3. Second middleware pass: cookie valid → next() → route returns 204
 *   4. AMA listens for iframe `onLoad` → removes hidden iframe
 *
 * Returns 200 (Next.js doesn't always honor 204 with empty body in dev).
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // Cookie đã được middleware set ở step 2 — route này chỉ ack thành công.
  return new NextResponse('OK', {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
