import { getTranslations } from 'next-intl/server';
import { Plus, Search } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@car-v2/ui';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';

interface UserRow {
  name: string;
  email: string;
  appRole: 'ADMIN' | 'MANAGER' | 'DRIVER';
  amaRole: 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';
  lastSeen: string;
  active: boolean;
}

const USERS: UserRow[] = [
  { name: 'Park Joon-ho',   email: 'park.joonho@hanatech.vn',  appRole: 'ADMIN',   amaRole: 'OWNER',   lastSeen: '2 min ago',   active: true  },
  { name: 'Kim Min-seo',    email: 'kim.minseo@hanatech.vn',   appRole: 'MANAGER', amaRole: 'MANAGER', lastSeen: '14 min ago',  active: true  },
  { name: 'Choi Ji-woo',    email: 'choi.jiwoo@hanatech.vn',   appRole: 'MANAGER', amaRole: 'MANAGER', lastSeen: '2 hr ago',    active: true  },
  { name: 'Nguyễn Văn Tú',  email: 'tu.nguyen@hanatech.vn',    appRole: 'DRIVER',  amaRole: 'MEMBER',  lastSeen: 'Just now',    active: true  },
  { name: 'Trần Quốc Hùng', email: 'hung.tran@hanatech.vn',    appRole: 'DRIVER',  amaRole: 'MEMBER',  lastSeen: '3 hr ago',    active: true  },
  { name: 'Lê Minh Đức',    email: 'duc.le@hanatech.vn',       appRole: 'DRIVER',  amaRole: 'MEMBER',  lastSeen: 'Yesterday',   active: true  },
  { name: 'Lee Hyun-jung',  email: 'lee.hyunjung@hanatech.vn', appRole: 'MANAGER', amaRole: 'MANAGER', lastSeen: '4 days ago',  active: false },
];

const ROLE_TONE: Record<UserRow['appRole'], 'accent' | 'info' | 'neutral'> = {
  ADMIN: 'accent', MANAGER: 'info', DRIVER: 'neutral',
};

export default async function UsersPage() {
  const t    = await getTranslations('screens.users');
  const tA   = await getTranslations('actions');
  const tNav = await getTranslations('nav');
  const tCo  = await getTranslations('company');

  return (
    <AppShell>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        breadcrumbs={[{ label: tCo('tenant') }, { label: tNav('users') }]}
        actions={
          <Button variant="accent" size="md" iconLeft={<Plus />}>Invite user</Button>
        }
      />

      <div className="flex-1 overflow-auto px-4 md:px-7 py-4 md:py-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <Input placeholder="Search by name or email…" iconLeft={<Search />} className="md:w-80" />
          <div className="text-xs md:text-sm text-text-muted">
            <span className="font-semibold text-text">{USERS.filter((u) => u.active).length}</span> active ·{' '}
            <span className="text-text-faint">{USERS.length - USERS.filter((u) => u.active).length} inactive</span>
          </div>
        </div>

        {/* Mobile: card list */}
        <ul className="md:hidden space-y-2.5">
          {USERS.map((u) => (
            <li key={u.email} className="rounded-md border border-border bg-surface px-4 py-3.5">
              <div className="flex items-start gap-3">
                <Avatar name={u.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-text truncate">{u.name}</div>
                      <div className="text-xs text-text-faint truncate">{u.email}</div>
                    </div>
                    <Badge tone={ROLE_TONE[u.appRole]} size="sm">{u.appRole}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-text-muted">AMA: <span className="font-mono">{u.amaRole}</span></span>
                    <span className={u.active ? 'text-text-faint' : 'text-text-faint italic'}>
                      {u.active ? u.lastSeen : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Card variant="outline" className="hidden md:block overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>App role</TableHead>
                <TableHead>AMA role</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-24 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {USERS.map((u) => (
                <TableRow key={u.email}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="md" />
                      <div className="min-w-0">
                        <div className="font-medium text-text truncate">{u.name}</div>
                        <div className="text-xs text-text-faint truncate">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={ROLE_TONE[u.appRole]} size="sm">{u.appRole}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{u.amaRole}</TableCell>
                  <TableCell className="text-text-muted">{u.lastSeen}</TableCell>
                  <TableCell className="text-right">
                    {u.active ? (
                      <Button variant="ghost" size="sm">{tA('edit')}</Button>
                    ) : (
                      <span className="text-xs text-text-faint italic">Inactive</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
