import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { LanguageEnum, ReportFormatEnum } from '@repo/api-types';
import { requireAuth } from '@/lib/api/auth-guard';
import { fromZod, handleError } from '@/lib/api/response';
import { fetchCostsByTypeForExport } from '@/lib/services/report.service';
import { buildSingleTypeExcel } from '@/lib/reports/excel';
import { buildSingleTypePdf } from '@/lib/reports/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  format: ReportFormatEnum.default('excel'),
  lang: LanguageEnum.default('en'),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return fromZod(parsed.error);
    const lang = parsed.data.lang ?? auth.language;

    const rows = await fetchCostsByTypeForExport({
      from: parsed.data.from,
      to: parsed.data.to,
      type: 'REPAIR_MAINTENANCE',
    });

    const args = {
      rows,
      from: parsed.data.from,
      to: parsed.data.to,
      lang,
      type: 'REPAIR_MAINTENANCE' as const,
    };

    if (parsed.data.format === 'excel') {
      const buf = await buildSingleTypeExcel(args);
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="repairs-${parsed.data.from}-to-${parsed.data.to}.xlsx"`,
        },
      });
    }
    const buf = await buildSingleTypePdf(args);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="repairs-${parsed.data.from}-to-${parsed.data.to}.pdf"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
