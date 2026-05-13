/**
 * Mock AMA entity members — once the AMA member-sync API ships, replace with
 * a real fetch. Mock members are returned with `role='UNASSIGNED'` and
 * `status='INACTIVE'` so the Admin must explicitly grant access by picking a
 * role and flipping status to ACTIVE.
 */

import type { UserRow } from '@/server/actions/user.actions';

interface MockSeed {
  name: string;
  email: string;
  amaRoleSnapshot: 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';
}

const SEEDS: MockSeed[] = [
  { name: 'Truc Hoang', email: 'truc.hoang@socialbean.vn', amaRoleSnapshot: 'OWNER' },
  { name: 'Linh Nguyen', email: 'linh.nguyen@socialbean.vn', amaRoleSnapshot: 'MANAGER' },
  { name: 'Huy Pham', email: 'huy.pham@socialbean.vn', amaRoleSnapshot: 'MANAGER' },
  { name: 'Minh Tran', email: 'minh.tran@socialbean.vn', amaRoleSnapshot: 'MEMBER' },
  { name: 'An Le', email: 'an.le@socialbean.vn', amaRoleSnapshot: 'MEMBER' },
  { name: 'Phuong Bui', email: 'phuong.bui@socialbean.vn', amaRoleSnapshot: 'MEMBER' },
  { name: 'Khanh Vo', email: 'khanh.vo@socialbean.vn', amaRoleSnapshot: 'MEMBER' },
];

export function getAmaMockMembers(): UserRow[] {
  const baseDate = new Date('2026-04-01T08:00:00Z').getTime();
  return SEEDS.map((seed, i) => ({
    usrId: `mock-ama-${i + 1}`,
    amaUserId: `ama-${1000 + i}`,
    email: seed.email,
    name: seed.name,
    role: 'UNASSIGNED',
    amaRoleSnapshot: seed.amaRoleSnapshot,
    status: 'INACTIVE',
    loginCount: 0,
    mfaLastAt: null,
    lastLoginAt: null,
    // Stagger created dates so they don't all share a timestamp
    createdAt: new Date(baseDate + i * 86_400_000).toISOString(),
  }));
}
