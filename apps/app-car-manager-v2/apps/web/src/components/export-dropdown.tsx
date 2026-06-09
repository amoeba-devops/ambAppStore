'use client';

import { Download, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { useLocale } from 'next-intl';
import { Button, cn } from '@car-v2/ui';

/* Next.js basePath from env — needed when app runs under a path prefix
 * (e.g., /app-car-manager-v2). Without this, absolute hrefs like
 * /api/v1/expenses/export would hit the wrong app (platform at /). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export interface ExportDropdownProps {
  /** Base URL for export endpoint (e.g., /api/v1/trips/export) */
  baseUrl: string;
  /** Additional query params to preserve (e.g., filters) */
  queryParams?: URLSearchParams | Record<string, string>;
  /** Labels for i18n */
  labels: {
    export: string;
    excel: string;
    pdf: string;
    csv: string;
  };
  /** Whether to show the dropdown on desktop (default: true) */
  showOnDesktop?: boolean;
  /** Button variant */
  variant?: 'ghost' | 'secondary' | 'accent';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

export function ExportDropdown({
  baseUrl,
  queryParams,
  labels,
  showOnDesktop = true,
  variant = 'ghost',
  size = 'md',
  className,
}: ExportDropdownProps) {
  const locale = useLocale();

  const buildHref = (format: 'xlsx' | 'pdf' | 'csv') => {
    const params = new URLSearchParams(
      queryParams instanceof URLSearchParams
        ? queryParams
        : queryParams
          ? Object.entries(queryParams)
          : [],
    );
    params.set('format', format);
    params.set('locale', locale);
    return `${basePath}${baseUrl}?${params.toString()}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          iconLeft={<Download />}
          className={cn(showOnDesktop ? '' : 'hidden md:inline-flex', className)}
        >
          {labels.export}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-50 min-w-[160px] rounded-lg border border-border bg-surface p-1 shadow-lg"
      >
        <DropdownMenuItem asChild>
          <a
            href={buildHref('xlsx')}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text hover:bg-surface-2 focus:bg-surface-2 focus:outline-none cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {labels.excel}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={buildHref('pdf')}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text hover:bg-surface-2 focus:bg-surface-2 focus:outline-none cursor-pointer"
          >
            <FileText className="h-4 w-4 text-red-500" />
            {labels.pdf}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={buildHref('csv')}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text hover:bg-surface-2 focus:bg-surface-2 focus:outline-none cursor-pointer"
          >
            <FileDown className="h-4 w-4 text-blue-500" />
            {labels.csv}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
