import Link from 'next/link';
import { Compass, Home } from 'lucide-react';
import { Button, Card, CardContent } from '@car-v2/ui';

export default function NotFoundPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-6">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent>
          <div className="flex flex-col items-center text-center py-2">
            <div className="h-14 w-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-5">
              <Compass className="h-6 w-6" />
            </div>
            <div className="text-[11px] font-semibold text-text-faint uppercase tracking-wider">404</div>
            <h1 className="mt-1 text-xl font-semibold text-text">Page not found</h1>
            <p className="mt-2 text-sm text-text-muted leading-relaxed max-w-xs">
              We couldn&apos;t locate that page. It may have been moved, renamed, or it never existed.
            </p>

            <Button variant="accent" size="lg" className="mt-6 w-full" asChild>
              <Link href="/"><Home />Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
