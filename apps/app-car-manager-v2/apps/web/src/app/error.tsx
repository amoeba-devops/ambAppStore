'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';

/* Global error boundary. Receives the error + a `reset()` callback that
 * re-renders the segment. We avoid logging full stack on the page itself
 * (already streamed to Render logs). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to dev console so engineers see it locally; in prod this also
    // shows up in the Render service logs.
    // eslint-disable-next-line no-console
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent>
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-5">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-text">Something went wrong</h1>
            <p className="mt-2 text-sm text-text-muted leading-relaxed max-w-xs">
              We hit an unexpected error while loading this page. The team has been notified.
            </p>

            {error.digest && (
              <code className="mt-4 inline-flex items-center font-mono text-[11px] tabular bg-surface-2 text-text-muted px-2 py-1 rounded">
                Error ref: {error.digest}
              </code>
            )}

            <div className="mt-6 flex gap-2 w-full">
              <Button variant="secondary" size="lg" className="flex-1" asChild>
                <Link href="/">Go home</Link>
              </Button>
              <Button variant="accent" size="lg" className="flex-1" iconLeft={<RotateCcw />} onClick={reset}>
                Try again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
