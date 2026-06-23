import { notFound } from 'next/navigation';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import { carUsers, carDrivers, carUserFleetAccess } from '@car-v2/db/schema';
import {
  DEV_ENT_ID,
  DEV_PERSONAS,
  loginHrefFor,
  localRoleFor,
  type DevPersona,
} from '@/lib/dev/test-personas';
import { SeedButton } from './_components/seed-button';

/**
 * Dev-only test-account picker (gated by DEMO_AUTO_LOGIN → 404 elsewhere). Seed
 * the personas, then one-click sign in as each role × department to exercise
 * the access model. Standalone page (outside the (app) shell) so it's reachable
 * without an existing session.
 */
export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<'ADMIN' | 'MANAGER' | 'DRIVER', string> = {
  ADMIN: 'Admin',
  MANAGER: 'Quản lý',
  DRIVER: 'Tài xế',
};

export default async function DevAccountsPage() {
  if (process.env.DEMO_AUTO_LOGIN !== 'true') notFound();

  const subs = DEV_PERSONAS.map((p) => p.sub).filter((s): s is string => Boolean(s));
  const [users, mems, drvs] = await Promise.all([
    subs.length
      ? db
          .select({ id: carUsers.usrAmaUserId })
          .from(carUsers)
          .where(and(eq(carUsers.entId, DEV_ENT_ID), inArray(carUsers.usrAmaUserId, subs)))
      : Promise.resolve([] as { id: string }[]),
    subs.length
      ? db
          .select({ usr: carUserFleetAccess.usrId, t: carUserFleetAccess.ufaVehicleType })
          .from(carUserFleetAccess)
          .where(
            and(
              eq(carUserFleetAccess.entId, DEV_ENT_ID),
              inArray(carUserFleetAccess.usrId, subs),
              isNull(carUserFleetAccess.ufaDeletedAt),
            ),
          )
      : Promise.resolve([] as { usr: string; t: string }[]),
    subs.length
      ? db
          .select({ usr: carDrivers.drvUserId })
          .from(carDrivers)
          .where(
            and(
              eq(carDrivers.entId, DEV_ENT_ID),
              inArray(carDrivers.drvUserId, subs),
              isNull(carDrivers.drvDeletedAt),
            ),
          )
      : Promise.resolve([] as { usr: string }[]),
  ]);

  const userSet = new Set(users.map((u) => u.id));
  const drvSet = new Set(drvs.map((d) => d.usr));
  const memBy = new Map<string, Set<string>>();
  for (const m of mems) {
    const set = memBy.get(m.usr) ?? new Set<string>();
    set.add(m.t);
    memBy.set(m.usr, set);
  }

  const isReady = (p: DevPersona): boolean => {
    if (!p.sub) return true; // OWNER uses the default identity (auto-provisioned)
    if (!userSet.has(p.sub)) return false;
    if (p.driver && !drvSet.has(p.sub)) return false;
    const have = memBy.get(p.sub) ?? new Set<string>();
    return p.depts.every((d) => have.has(d));
  };

  const missingCount = DEV_PERSONAS.filter((p) => p.sub && !isReady(p)).length;

  return (
    <main className="min-h-dvh bg-bg text-text px-5 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-xl font-bold">Tài khoản test (dev)</h1>
          <p className="text-sm text-text-muted">
            Đăng nhập nhanh theo từng vai trò × phòng ban để kiểm thử phân quyền. Chỉ hoạt động khi{' '}
            <code className="rounded bg-surface-2 px-1">DEMO_AUTO_LOGIN=true</code> — tự 404 trên staging/prod.
          </p>
        </header>

        <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning-soft/30 px-4 py-3">
          <div className="flex-1 text-sm">
            {missingCount > 0
              ? `${missingCount} tài khoản chưa được tạo. Bấm để tạo trước khi đăng nhập.`
              : 'Tất cả tài khoản đã sẵn sàng. Bấm để đồng bộ lại nếu cần.'}
          </div>
          <SeedButton />
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {DEV_PERSONAS.map((p) => {
            const ready = isReady(p);
            const role = localRoleFor(p);
            return (
              <li
                key={p.key}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-text">{p.name}</div>
                    <div className="mt-0.5 text-xs text-text-muted">{p.note}</div>
                  </div>
                  <span
                    className={
                      ready
                        ? 'shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-semibold text-success'
                        : 'shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-text-faint'
                    }
                  >
                    {ready ? 'Sẵn sàng' : 'Chưa tạo'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
                    {ROLE_LABEL[role]}
                  </span>
                  {p.depts.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-text-muted"
                    >
                      {d === 'TRUCK' ? 'Xe tải' : 'Xe con'}
                    </span>
                  ))}
                </div>

                {/* Plain <a> (not Link) → full GET to the dev-login route handler
                 * so the Set-Cookie + redirect actually fire. */}
                <a
                  href={loginHrefFor(p)}
                  aria-disabled={!ready}
                  className={
                    ready
                      ? 'inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
                      : 'pointer-events-none inline-flex items-center justify-center rounded-md bg-surface-2 px-3 py-2 text-sm font-semibold text-text-faint'
                  }
                >
                  Đăng nhập
                </a>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-text-faint">
          Mẹo: để test tài xế Xe tải hoàn thành chuyến, đăng nhập admin/QL Xe tải → tạo chuyến chế độ
          “Giao tài xế” gán cho tài xế tương ứng, rồi đăng nhập tài xế đó.
        </p>
      </div>
    </main>
  );
}
