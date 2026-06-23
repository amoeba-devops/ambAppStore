/**
 * Dev-only test personas (gated by DEMO_AUTO_LOGIN). One identity per
 * role × department combination so the access model can be exercised end to
 * end without real AMA accounts. Seeded by `seedDevAccountsAction` and logged
 * in via `/dev-login?role=…&sub=…&ent_id=…`.
 *
 * NOT shipped to staging/prod behaviour — every consumer checks
 * `process.env.DEMO_AUTO_LOGIN === 'true'` first.
 */

export const DEV_ENT_ID = '00000000-0000-4000-8000-000000000010';

export type DevLoginRole = 'OWNER' | 'MANAGER' | 'MEMBER';
export type DevDept = 'CAR' | 'TRUCK';

export interface DevPersona {
  key: string;
  /** Display name stored in car_users + shown on the picker card. */
  name: string;
  /** Short Vietnamese description of what this persona is for. */
  note: string;
  /** dev-login role param → JWT role (drives mapAmaRoleToLocal). */
  loginRole: DevLoginRole;
  /** Fixed sub override; omitted for the default OWNER identity. */
  sub?: string;
  /** Fleet memberships to grant (managers 1–2, drivers exactly 1). */
  depts: DevDept[];
  /** When set, also seed a car_drivers row so the driver flow works. */
  driver?: { drvId: string; license: string };
}

/* Fixed v4-shaped UUIDs (valid for Zod .uuid()), readable suffixes:
 *   …00cN = manager subs · …00dN = driver subs · …00eN = car_drivers ids */
export const DEV_PERSONAS: DevPersona[] = [
  {
    key: 'admin',
    name: 'Demo OWNER',
    note: 'Admin tổ chức — cả 2 phòng + công cụ tổ chức',
    loginRole: 'OWNER',
    depts: ['CAR', 'TRUCK'],
  },
  {
    key: 'mgr-car',
    name: 'QT Xe con',
    note: 'Admin phòng Xe con (manager chỉ CAR)',
    loginRole: 'MANAGER',
    sub: '0a0a0a0a-0000-4000-8000-0000000000c1',
    depts: ['CAR'],
  },
  {
    key: 'mgr-truck',
    name: 'QT Xe tải',
    note: 'Admin phòng Xe tải (manager chỉ TRUCK)',
    loginRole: 'MANAGER',
    sub: '0a0a0a0a-0000-4000-8000-0000000000c2',
    depts: ['TRUCK'],
  },
  {
    key: 'mgr-both',
    name: 'QL 2 phòng',
    note: 'Quản lý cả 2 phòng (có switch Car/Truck)',
    loginRole: 'MANAGER',
    sub: '0a0a0a0a-0000-4000-8000-0000000000c3',
    depts: ['CAR', 'TRUCK'],
  },
  {
    key: 'drv-car',
    name: 'Tài xế Xe con',
    note: 'Driver phòng Xe con (luồng điều xe)',
    loginRole: 'MEMBER',
    sub: '0a0a0a0a-0000-4000-8000-0000000000d1',
    depts: ['CAR'],
    driver: { drvId: '0a0a0a0a-0000-4000-8000-0000000000e1', license: 'DEV-CAR-01' },
  },
  {
    key: 'drv-truck',
    name: 'Tài xế Xe tải',
    note: 'Driver phòng Xe tải (hoàn thành chuyến log)',
    loginRole: 'MEMBER',
    sub: '0a0a0a0a-0000-4000-8000-0000000000d2',
    depts: ['TRUCK'],
    driver: { drvId: '0a0a0a0a-0000-4000-8000-0000000000e2', license: 'DEV-TRK-01' },
  },
];

/** Local role a persona resolves to (mirrors mapAmaRoleToLocal). */
export function localRoleFor(p: DevPersona): 'ADMIN' | 'MANAGER' | 'DRIVER' {
  return p.loginRole === 'OWNER' ? 'ADMIN' : p.loginRole === 'MANAGER' ? 'MANAGER' : 'DRIVER';
}

/** The dashboard this persona should land on, mirroring RootRedirect's logic
 * (driver → /today; CAR-first when the user has car access; truck-only →
 * /truck/dashboard). Landing here directly skips the `/` redirect hop, so the
 * full-shell loading skeleton only renders ONCE instead of twice (no flash). */
export function landingPathFor(p: DevPersona): string {
  if (localRoleFor(p) === 'DRIVER') return '/today';
  if (p.depts.includes('CAR')) return '/dashboard';
  if (p.depts.includes('TRUCK')) return '/truck/dashboard';
  return '/dashboard';
}

/** `/dev-login` URL that signs in as this persona, landing straight on the
 * resolved dept dashboard (no `/` redirect hop → no double skeleton flash). */
export function loginHrefFor(p: DevPersona): string {
  const params = new URLSearchParams({ role: p.loginRole, next: landingPathFor(p) });
  if (p.sub) {
    params.set('sub', p.sub);
    params.set('ent_id', DEV_ENT_ID);
  }
  return `/dev-login?${params.toString()}`;
}
