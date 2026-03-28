import { type ReactNode } from 'react';
import { StatusBadge } from './StatusBadge';

interface PageHeaderProps {
  title: string;
  breadcrumb?: string[];
  actions?: ReactNode;
  liveBadge?: boolean;
}

export function PageHeader({ title, breadcrumb, actions, liveBadge }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-1 flex items-center gap-1 text-sm text-gray-400">
            {breadcrumb.map((item, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">/</span>}
                {item}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {liveBadge && <StatusBadge label="LIVE" variant="live" dot pulse />}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
