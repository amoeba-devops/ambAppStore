import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  CostTypeEnum,
  LanguageEnum,
  ReportFormatEnum,
} from '@repo/api-types';
import { requireAuth } from '@/lib/api/auth-guard';
import { fromZod, handleError } from '@/lib/api/response';
import { fetchCostsForExport } from '@/lib/services/report.service';
import { buildCostsExcel } from '@/lib/reports/excel';
import { buildCostsPdf } from '@/lib/reports/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  vehicleId: z.string().uuid().optional(),
  type: CostTypeEnum.optional(),
  format: ReportFormatEnum.default('excel'),
  lang: LanguageEnum.default('en'),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return fromZod(parsed.error);

    const lang = parsed.data.lang ?? auth.language;
    const rows = await fetchCostsForExport({
      from: parsed.data.from,
      to: parsed.data.to,
      vehicleId: parsed.data.vehicleId,
      type: parsed.data.type,
    });

    if (parsed.data.format === 'excel') {
      const buf = await buildCostsExcel({ rows, from: parsed.data.from, to: parsed.data.to, lang });
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="costs-${parsed.data.from}-to-${parsed.data.to}.xlsx"`,
        },
      });
    }

    const buf = await buildCostsPdf({ rows, from: parsed.data.from, to: parsed.data.to, lang });
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="costs-${parsed.data.from}-to-${parsed.data.to}.pdf"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
