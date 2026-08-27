import type { AssignmentWarning } from '@car-v2/shared/errors';

/**
 * Localize one assignment-guard warning (see
 * @car-v2/shared/errors/assignment-guard) for the confirm dialog and toasts.
 * `t` is the ROOT next-intl translator (`useTranslations()`), because status
 * labels live under `drivers.status.*` / `vehicles.status.*`.
 */
export function formatAssignmentWarning(
  warning: AssignmentWarning,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  switch (warning.code) {
    case 'DRIVER_ON_ACTIVE_TRIP':
      return t('guard.DRIVER_ON_ACTIVE_TRIP', { refs: (warning.refs ?? []).join(', ') });
    case 'DRIVER_STATUS_NOT_AVAILABLE':
      return t('guard.DRIVER_STATUS_NOT_AVAILABLE', {
        status: warning.status ? t(`drivers.status.${warning.status}`) : '?',
      });
    case 'VEHICLE_IN_USE':
      return t('guard.VEHICLE_IN_USE', { plate: warning.plate ?? '?' });
    case 'VEHICLE_MAINTENANCE':
      return t('guard.VEHICLE_MAINTENANCE', { plate: warning.plate ?? '?' });
  }
}
