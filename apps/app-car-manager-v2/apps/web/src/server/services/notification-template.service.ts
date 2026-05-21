import 'server-only';
import { buildAppUrl } from '@/lib/env';

/**
 * Locale-aware notification copy for the 6 trip events.
 *
 * Each event produces the same shape `{ subject, body, plainText, html, url }`:
 *   - subject + body are short — used by both email subject/preheader AND
 *     Web Push notification title/body (push has ~120 char limit per provider).
 *   - html + plainText are the email body (richer than push).
 *   - url points the user back to the trip detail.
 *
 * Translation tables live in code (not i18n JSON) because the renderer runs
 * server-side without a Next.js request context — pulling from next-intl
 * `getRequestConfig` here would couple template render to the active locale
 * of the request, but we need the RECIPIENT's locale. Inline is simpler.
 */

export type SupportedLocale = 'vi' | 'en' | 'ko';

const SUPPORTED_LOCALES: SupportedLocale[] = ['vi', 'en', 'ko'];

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  const v = (input ?? '').toLowerCase();
  if (v === 'en' || v === 'ko') return v;
  return 'vi';
}

export type NotificationEvent =
  | 'TRIP.ASSIGNED'
  | 'TRIP.NEEDS_ASSIGNMENT'
  | 'TRIP.ACCEPTED'
  | 'TRIP.REJECTED'
  | 'TRIP.COMPLETED'
  | 'TRIP.CANCELLED'
  | 'EXPENSE.ACCIDENT_REPORTED'
  | 'MAINTENANCE.OIL_OVERDUE'
  | 'MAINTENANCE.OIL_DUE_SOON'
  | 'MAINTENANCE.INSPECTION_OVERDUE'
  | 'MAINTENANCE.INSPECTION_DUE_SOON';

export interface TemplateContext {
  /** Trip reference like "TR-1042". */
  ref: string;
  /** Human-friendly route summary, e.g. "Quận 1 → Sân bay TSN". */
  route?: string;
  /** Free-form reason for reject/cancel events. */
  reason?: string;
  /** Trip detail path, e.g. `/trips/abc-123`. URL built via `buildAppUrl`. */
  tripPath: string;
}

export interface RenderedNotification {
  subject: string;
  body: string;
  plainText: string;
  html: string;
  /** Absolute URL to the trip detail. */
  url: string;
}

/* ─── Copy by locale ───────────────────────────────────────────────────── */

const COPY: Record<
  SupportedLocale,
  Record<NotificationEvent, { subject: string; body: (ctx: TemplateContext) => string }>
> = {
  vi: {
    'TRIP.ASSIGNED': {
      subject: 'Bạn vừa được giao chuyến đi mới',
      body: (c) => `Chuyến ${c.ref}${c.route ? ` (${c.route})` : ''} cần bạn xác nhận.`,
    },
    'TRIP.NEEDS_ASSIGNMENT': {
      subject: 'Có chuyến đi mới cần phân công',
      body: (c) => `Chuyến ${c.ref}${c.route ? ` (${c.route})` : ''} chưa có tài xế.`,
    },
    'TRIP.ACCEPTED': {
      subject: 'Tài xế đã xác nhận chuyến',
      body: (c) => `Tài xế đã đồng ý chuyến ${c.ref}.`,
    },
    'TRIP.REJECTED': {
      subject: 'Tài xế đã từ chối chuyến',
      body: (c) =>
        `Tài xế từ chối chuyến ${c.ref}${c.reason ? `. Lý do: ${c.reason}` : ''}. Vui lòng phân công lại.`,
    },
    'TRIP.COMPLETED': {
      subject: 'Chuyến đi đã hoàn tất',
      body: (c) => `Chuyến ${c.ref} đã được tài xế kết thúc.`,
    },
    'TRIP.CANCELLED': {
      subject: 'Chuyến đi đã bị huỷ',
      body: (c) => `Chuyến ${c.ref} đã bị huỷ${c.reason ? `. Lý do: ${c.reason}` : ''}.`,
    },
    'EXPENSE.ACCIDENT_REPORTED': {
      subject: 'Có sự cố tai nạn vừa được ghi nhận',
      body: (c) => `Chi phí tai nạn ${c.ref} vừa được ghi nhận. Vui lòng kiểm tra.`,
    },
    'MAINTENANCE.OIL_OVERDUE': {
      subject: 'Quá hạn thay dầu',
      body: (c) => `Xe ${c.ref} đã quá hạn thay dầu, cần xử lý ngay.`,
    },
    'MAINTENANCE.OIL_DUE_SOON': {
      subject: 'Sắp đến hạn thay dầu',
      body: (c) => `Xe ${c.ref} sắp đến hạn thay dầu, vui lòng lên kế hoạch.`,
    },
    'MAINTENANCE.INSPECTION_OVERDUE': {
      subject: 'Quá hạn đăng kiểm',
      body: (c) => `Xe ${c.ref} đã quá hạn đăng kiểm.`,
    },
    'MAINTENANCE.INSPECTION_DUE_SOON': {
      subject: 'Sắp đến hạn đăng kiểm',
      body: (c) => `Xe ${c.ref} sắp đến hạn đăng kiểm.`,
    },
  },
  en: {
    'TRIP.ASSIGNED': {
      subject: 'New trip assigned to you',
      body: (c) => `Trip ${c.ref}${c.route ? ` (${c.route})` : ''} needs your confirmation.`,
    },
    'TRIP.NEEDS_ASSIGNMENT': {
      subject: 'A trip needs a driver',
      body: (c) => `Trip ${c.ref}${c.route ? ` (${c.route})` : ''} has no driver yet.`,
    },
    'TRIP.ACCEPTED': {
      subject: 'Driver accepted the trip',
      body: (c) => `The driver accepted trip ${c.ref}.`,
    },
    'TRIP.REJECTED': {
      subject: 'Driver rejected the trip',
      body: (c) =>
        `The driver rejected trip ${c.ref}${c.reason ? `. Reason: ${c.reason}` : ''}. Please reassign.`,
    },
    'TRIP.COMPLETED': {
      subject: 'Trip completed',
      body: (c) => `Trip ${c.ref} was ended by the driver.`,
    },
    'TRIP.CANCELLED': {
      subject: 'Trip cancelled',
      body: (c) => `Trip ${c.ref} was cancelled${c.reason ? `. Reason: ${c.reason}` : ''}.`,
    },
    'EXPENSE.ACCIDENT_REPORTED': {
      subject: 'New accident expense reported',
      body: (c) => `Accident expense ${c.ref} has been recorded. Please review.`,
    },
    'MAINTENANCE.OIL_OVERDUE': {
      subject: 'Oil change overdue',
      body: (c) => `Vehicle ${c.ref} is overdue for an oil change.`,
    },
    'MAINTENANCE.OIL_DUE_SOON': {
      subject: 'Oil change due soon',
      body: (c) => `Vehicle ${c.ref} is approaching oil change interval.`,
    },
    'MAINTENANCE.INSPECTION_OVERDUE': {
      subject: 'Inspection overdue',
      body: (c) => `Vehicle ${c.ref} is overdue for inspection.`,
    },
    'MAINTENANCE.INSPECTION_DUE_SOON': {
      subject: 'Inspection due soon',
      body: (c) => `Vehicle ${c.ref} is approaching its inspection date.`,
    },
  },
  ko: {
    'TRIP.ASSIGNED': {
      subject: '새 운행이 배정되었습니다',
      body: (c) => `운행 ${c.ref}${c.route ? ` (${c.route})` : ''}을(를) 확인해 주세요.`,
    },
    'TRIP.NEEDS_ASSIGNMENT': {
      subject: '기사 배정이 필요한 운행',
      body: (c) => `운행 ${c.ref}${c.route ? ` (${c.route})` : ''}에 기사가 배정되지 않았습니다.`,
    },
    'TRIP.ACCEPTED': {
      subject: '기사가 운행을 수락했습니다',
      body: (c) => `기사가 운행 ${c.ref}을(를) 수락했습니다.`,
    },
    'TRIP.REJECTED': {
      subject: '기사가 운행을 거절했습니다',
      body: (c) =>
        `기사가 운행 ${c.ref}을(를) 거절했습니다${c.reason ? `. 사유: ${c.reason}` : ''}. 다시 배정해 주세요.`,
    },
    'TRIP.COMPLETED': {
      subject: '운행이 완료되었습니다',
      body: (c) => `운행 ${c.ref}이(가) 기사에 의해 종료되었습니다.`,
    },
    'TRIP.CANCELLED': {
      subject: '운행이 취소되었습니다',
      body: (c) => `운행 ${c.ref}이(가) 취소되었습니다${c.reason ? `. 사유: ${c.reason}` : ''}.`,
    },
    'EXPENSE.ACCIDENT_REPORTED': {
      subject: '사고 비용이 보고되었습니다',
      body: (c) => `사고 비용 ${c.ref}이(가) 기록되었습니다. 확인해 주세요.`,
    },
    'MAINTENANCE.OIL_OVERDUE': {
      subject: '오일 교체 기한 초과',
      body: (c) => `차량 ${c.ref}의 오일 교체 기한이 지났습니다.`,
    },
    'MAINTENANCE.OIL_DUE_SOON': {
      subject: '오일 교체 임박',
      body: (c) => `차량 ${c.ref}의 오일 교체 시기가 다가옵니다.`,
    },
    'MAINTENANCE.INSPECTION_OVERDUE': {
      subject: '검사 기한 초과',
      body: (c) => `차량 ${c.ref}의 검사 기한이 지났습니다.`,
    },
    'MAINTENANCE.INSPECTION_DUE_SOON': {
      subject: '검사 기한 임박',
      body: (c) => `차량 ${c.ref}의 검사 일정이 다가옵니다.`,
    },
  },
};

const CTA: Record<SupportedLocale, string> = {
  vi: 'Xem chuyến',
  en: 'View trip',
  ko: '운행 보기',
};

/* ─── Render entry point ───────────────────────────────────────────────── */

export function renderNotification(
  event: NotificationEvent,
  locale: SupportedLocale,
  ctx: TemplateContext,
): RenderedNotification {
  const table = COPY[locale] ?? COPY.vi;
  const tpl = table[event];
  const subject = tpl.subject;
  const body = tpl.body(ctx);
  const url = buildAppUrl(ctx.tripPath);

  /* Email HTML — intentionally minimalist (no React Email yet). Inline styles
   * because Gmail strips <style>. Content matches plainText 1:1 so spam
   * filters and screen readers see the same text. */
  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr><td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
          <tr><td style="padding:24px;">
            <h1 style="margin:0 0 12px;font-size:18px;line-height:1.4;color:#111827;">${escapeHtml(subject)}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">${escapeHtml(body)}</p>
            <p style="margin:0;">
              <a href="${url}" style="display:inline-block;background:#3182f6;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(CTA[locale])}</a>
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">${escapeHtml(ctx.ref)} · CCMS</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const plainText = `${subject}\n\n${body}\n\n${CTA[locale]}: ${url}\n\n— ${ctx.ref} · CCMS`;

  return { subject, body, plainText, html, url };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* Re-export so callers can iterate. */
export { SUPPORTED_LOCALES };
