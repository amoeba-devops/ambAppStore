import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'ok',
      service: 'sales-report-v2-web',
      timestamp: new Date().toISOString(),
    },
  });
}
