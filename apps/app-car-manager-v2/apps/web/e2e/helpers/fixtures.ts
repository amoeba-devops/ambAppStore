/**
 * Test fixtures — real data từ db_amb VN01 entity.
 *
 * Yêu cầu local stack đang chạy:
 *   - ambManagement API :3019 với PostgreSQL `db_amb`
 *   - car-v2 :3000 với JWT_SECRET sync, DEMO_AUTO_LOGIN=true
 *   - Neon dev DB reachable (car_users, car_tenant_settings)
 *
 * Entity VN01 chứa 6 members:
 *   - 1 ADMIN_LEVEL (System Admin) — filter out khi sync
 *   - 1 USER_LEVEL ADMIN (VN Admin)
 *   - 1 USER_LEVEL MASTER (VN Master)
 *   - 1 USER_LEVEL MANAGER (Trần Thị Lan)
 *   - 2 USER_LEVEL MEMBER (drivers)
 *
 * Sau bulk sync → kỳ vọng car_users có 5 rows (loại ADMIN_LEVEL).
 */

export const VN01 = {
  entId: '3b8ee021-36a1-48c3-858a-86561b2b0db4',
  entCode: 'VN01',
  expectedTotalMembers: 6,
  expectedSyncedMembers: 5, // sau khi filter ADMIN_LEVEL
  expectedSkipped: 1,
} as const;

export const VN01_USERS = {
  master: {
    sub: 'cb36bc3e-d8a9-4763-9566-0293dfde1d11',
    email: 'master@amoeba.vn',
    name: 'VN Master',
    role: 'MASTER' as const,
    devLoginRole: 'MASTER' as const,
  },
  admin: {
    sub: 'fadaa0a2-e791-4642-8341-de1a24c248b0',
    email: 'admin.vn@amoeba.group',
    name: 'VN Admin',
    role: 'ADMIN' as const,
    devLoginRole: 'MASTER' as const, // dev-login chỉ accept OWNER/MASTER/MANAGER/MEMBER
  },
  manager: {
    sub: '4dae64af-25f8-427c-9805-0ded82769bfb',
    email: 'vn-manager@amoeba.vn',
    name: 'Trần Thị Lan',
    role: 'MANAGER' as const,
    devLoginRole: 'MANAGER' as const,
  },
  driver: {
    sub: 'c74d5893-74e1-4be9-a1eb-17e9dfa19df0',
    email: 'vn-driver@amoeba.vn',
    name: 'VN Driver',
    role: 'MEMBER' as const,
    devLoginRole: 'MEMBER' as const,
  },
  /** ADMIN_LEVEL — cross-entity, không xuất hiện trong car_users sau sync */
  systemAdmin: {
    sub: 'f1582805-f0a0-4e31-8680-fbf164f5c036',
    email: 'admin@amoeba.group',
    name: 'System Admin',
  },
} as const;
