import 'server-only';
import { Resend } from 'resend';
import { getEmailConfig } from '@/lib/env';

/**
 * Thin Resend wrapper for transactional email.
 *
 * Returns `{ ok: false, reason: 'disabled' }` when Resend env not configured —
 * caller treats this as a no-op (DB notification still queued).
 * Never throws on send failure; logs + returns `{ ok: false, reason: 'error' }`
 * so the parent mutation doesn't crash because of an email outage.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback for clients that don't render HTML. */
  text?: string;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'disabled' | 'invalid_recipient' | 'error'; message?: string };

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (resendClient) return resendClient;
  const cfg = getEmailConfig();
  if (!cfg) return null;
  resendClient = new Resend(cfg.apiKey);
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = getEmailConfig();
  const client = getClient();
  if (!cfg || !client) return { ok: false, reason: 'disabled' };

  if (!input.to || !input.to.includes('@')) {
    return { ok: false, reason: 'invalid_recipient' };
  }

  try {
    const { data, error } = await client.emails.send({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: cfg.replyTo,
    });
    if (error || !data) {
      /* eslint-disable-next-line no-console */
      console.error('[email] Resend rejected:', error);
      return { ok: false, reason: 'error', message: error?.message };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    /* eslint-disable-next-line no-console */
    console.error('[email] send threw:', e);
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'unknown' };
  }
}
