'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { History, X } from 'lucide-react';
import { Alert, AlertTitle, Button } from '@car-v2/ui';

interface DraftRestoreBannerProps {
  /** Wall-clock save time (Unix ms) of the saved draft. */
  savedAt: number;
  /** User clicks "Continue" — caller applies draft values to form state. */
  onRestore: () => void;
  /** User clicks "Discard" — caller clears the draft from storage. */
  onDiscard: () => void;
  className?: string;
}

/**
 * Banner shown above a form when a stored draft is detected.
 *
 * Two outcomes:
 *   - Restore → caller's onRestore() rehydrates form state from draft
 *   - Discard → caller's onDiscard() wipes the stored draft
 * Either way, the banner hides itself (caller flips draft state to null).
 */
export function DraftRestoreBanner({
  savedAt,
  onRestore,
  onDiscard,
  className,
}: DraftRestoreBannerProps) {
  const t = useTranslations('forms.draft');
  const f = useFormatter();

  return (
    <Alert
      variant="info"
      className={className}
      icon={<History />}
    >
      <AlertTitle>{t('title')}</AlertTitle>
      <div className="mt-0.5 text-text-muted text-xs leading-relaxed">
        {t('savedRelative', {
          time: f.relativeTime(new Date(savedAt), { now: Date.now() }),
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="accent" onClick={onRestore} className="h-7 px-2.5 text-xs">
          {t('restore')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDiscard}
          iconLeft={<X />}
          className="h-7 px-2.5 text-xs"
        >
          {t('discard')}
        </Button>
      </div>
    </Alert>
  );
}
