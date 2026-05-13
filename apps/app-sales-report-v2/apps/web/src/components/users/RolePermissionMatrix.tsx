import { Check, Minus } from 'lucide-react';
import { cn } from '@v2/ui';

type Role = 'OPERATOR' | 'MANAGER' | 'ADMIN';

interface Permission {
  label: string;
  roles: Record<Role, boolean>;
}

const PERMISSIONS: Permission[] = [
  { label: 'Upload CSV files', roles: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { label: 'Input / edit manual data', roles: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { label: 'View reports', roles: { OPERATOR: true, MANAGER: true, ADMIN: true } },
  { label: 'Download reports', roles: { OPERATOR: true, MANAGER: true, ADMIN: true } },
  { label: 'Edit Prime Cost / COGS', roles: { OPERATOR: true, MANAGER: false, ADMIN: true } },
  { label: 'View Activity Log', roles: { OPERATOR: false, MANAGER: true, ADMIN: true } },
  { label: 'Manage users', roles: { OPERATOR: false, MANAGER: false, ADMIN: true } },
  { label: 'Configure formulas', roles: { OPERATOR: false, MANAGER: false, ADMIN: true } },
];

const ROLES: Role[] = ['OPERATOR', 'MANAGER', 'ADMIN'];

export function RolePermissionMatrix() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Role Permission Matrix</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Permission</th>
              {ROLES.map((r) => (
                <th key={r} className="px-5 py-2.5 text-center font-medium">
                  {r[0] + r.slice(1).toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {PERMISSIONS.map((p) => (
              <tr key={p.label} className="hover:bg-neutral-50/60">
                <td className="px-5 py-3 text-neutral-700">{p.label}</td>
                {ROLES.map((r) => {
                  const allowed = p.roles[r];
                  return (
                    <td key={r} className="px-5 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full',
                          allowed ? 'bg-success-50 text-success-500' : 'text-neutral-300',
                        )}
                      >
                        {allowed ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
