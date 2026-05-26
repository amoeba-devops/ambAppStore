import type { TFunction } from 'i18next';

const STATUS_KEY: Record<string, string> = {
  IN_PROGRESS: 'tripLog.statusInProgress',
  COMPLETED: 'tripLog.statusCompleted',
  VERIFIED: 'tripLog.statusVerified',
  VOIDED: 'tripLog.statusVoided',
};

export function tripLogStatusLabel(status: string, t: TFunction): string {
  const key = STATUS_KEY[status];
  return key ? (t(key) as string) : status;
}
