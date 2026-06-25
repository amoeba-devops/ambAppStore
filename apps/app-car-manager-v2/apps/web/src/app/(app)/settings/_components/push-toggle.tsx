'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button, Switch } from '@car-v2/ui';
import { usePushSubscription, type PushState } from '@/hooks/use-push-subscription';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface PushToggleProps {
  vapidPublicKey: string | undefined;
  basePath: string;
}

/**
 * Settings → Notifications row for "Push notification".
 *
 * Server passes VAPID public key + basePath as props — both come from the
 * server-side env loader (basePath from next.config.ts BASE_PATH).
 *
 * When VAPID isn't configured (`vapidPublicKey` empty), toggle is disabled
 * with a hint — admin can still see the row but can't subscribe.
 */
export function PushToggle({ vapidPublicKey, basePath: _basePath }: PushToggleProps) {
  const t = useTranslations('settings');
  const tPush = useTranslations('settings.push');
  const { state, errorMessage, subscribe, unsubscribe } = usePushSubscription({
    vapidPublicKey,
    basePath: _basePath,
  });

  const isSubscribed = state === 'subscribed';
  const isBusy = state === 'subscribing';
  const isDisabled =
    !vapidPublicKey ||
    state === 'unsupported' ||
    state === 'iframe' ||
    state === 'denied' ||
    isBusy;

  const onCheckedChange = (next: boolean) => {
    if (isBusy) return;
    if (next) void subscribe();
    else void unsubscribe();
  };

  /* When in iframe, show a button to open settings in new tab */
  const handleOpenInNewTab = () => {
    window.open(`${basePath}/settings/me`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text">{t('notifPush')}</div>
        <div className="text-xs text-text-muted mt-0.5">{t('notifPushDesc')}</div>
        <HintForState
          state={state}
          errorMessage={errorMessage}
          configured={Boolean(vapidPublicKey)}
          tPush={tPush}
          onOpenNewTab={handleOpenInNewTab}
        />
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-faint" />}
        {state !== 'iframe' && (
          <Switch checked={isSubscribed} onCheckedChange={onCheckedChange} disabled={isDisabled} />
        )}
      </div>
    </div>
  );
}

function HintForState({
  state,
  errorMessage,
  configured,
  tPush,
  onOpenNewTab,
}: {
  state: PushState;
  errorMessage: string | null;
  configured: boolean;
  tPush: ReturnType<typeof useTranslations>;
  onOpenNewTab: () => void;
}) {
  if (!configured) {
    return <div className="text-xs text-text-faint mt-1.5 italic">{tPush('serverDisabled')}</div>;
  }
  if (state === 'iframe') {
    return (
      <div className="mt-2">
        <div className="text-xs text-text-muted mb-1.5">{tPush('iframeHint')}</div>
        <Button
          variant="secondary"
          size="sm"
          iconRight={<ExternalLink className="h-3 w-3" />}
          onClick={onOpenNewTab}
        >
          {tPush('openNewTab')}
        </Button>
      </div>
    );
  }
  if (state === 'unsupported') {
    return <div className="text-xs text-text-faint mt-1.5 italic">{tPush('unsupported')}</div>;
  }
  if (state === 'denied') {
    return <div className="text-xs text-danger mt-1.5">{tPush('denied')}</div>;
  }
  if (state === 'error' && errorMessage) {
    return <div className="text-xs text-danger mt-1.5">{tPush('error', { message: errorMessage })}</div>;
  }
  if (state === 'subscribed') {
    return <div className="text-xs text-success mt-1.5">{tPush('subscribed')}</div>;
  }
  return null;
}
