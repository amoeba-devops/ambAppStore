'use client';
import { Toaster as SonnerToaster, toast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors={false}
      closeButton
      duration={3500}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: 'group toast rounded-md border border-border bg-surface text-text shadow-pop px-4 py-3 text-sm',
          title: 'font-semibold',
          description: 'text-text-muted',
          actionButton: 'bg-accent text-accent-fg rounded px-2.5 py-1 text-xs font-medium',
          cancelButton: 'bg-surface-2 text-text rounded px-2.5 py-1 text-xs',
          success: '[&>div[data-icon]]:text-success',
          error:   '[&>div[data-icon]]:text-danger',
          warning: '[&>div[data-icon]]:text-warning',
          info:    '[&>div[data-icon]]:text-info',
        },
      }}
    />
  );
}

export { toast };
