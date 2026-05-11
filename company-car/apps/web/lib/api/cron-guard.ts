import type { NextRequest } from 'next/server';
import { HttpError } from './response';

export function requireCronSecret(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new HttpError(503, 'CRON_NOT_CONFIGURED', 'CRON_SECRET is not set');
  }
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token');
  }
  if (auth.slice(7) !== expected) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid cron secret');
  }
}
