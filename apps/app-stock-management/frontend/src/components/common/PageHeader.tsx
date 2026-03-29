import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  breadcrumb?: string[];
  actions?: ReactNode;
}

export function PageHeader({ title, breadcrumb, actions }: PageHeaderProps) {
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
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
