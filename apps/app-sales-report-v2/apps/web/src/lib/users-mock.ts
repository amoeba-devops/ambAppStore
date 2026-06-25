/**
 * Mock AMA entity members — single source of truth for both client-side display
 * (UserAccountsCard merges these as "UNASSIGNED/INACTIVE" rows when not yet in
 * sal_users) and server-side `MockAmaClient` (used by syncFromAmaAction when
 * no real AMA endpoint is configured).
 *
 * Once the AMA member-sync API ships (Phase 2), HttpAmaClient replaces
 * MockAmaClient and these seeds can be deleted along with the client-side
 * merge logic.
 */

import type { UserRow } from '@/server/actions/user.actions';

export interface MockAmaMember {
  amaUserId: string;
  email: string;
  name: string;
  amaRole: 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';
}

// AMA IDs are 36-char UUIDs in production. Mock IDs must also be 36 chars so
// the `char(36)` column doesn't pad them with trailing spaces and break Map
// lookups in syncFromAmaAction (existingByAmaId.get vs amaIds.has).
export const MOCK_AMA_MEMBERS: MockAmaMember[] = [
  { amaUserId: '00000000-0000-0000-0000-00000000a000', name: 'Truc Hoang', email: 'truc.hoang@socialbean.vn', amaRole: 'OWNER' },
  { amaUserId: '00000000-0000-0000-0000-00000000a001', name: 'Linh Nguyen', email: 'linh.nguyen@socialbean.vn', amaRole: 'MANAGER' },
  { amaUserId: '00000000-0000-0000-0000-00000000a002', name: 'Huy Pham', email: 'huy.pham@socialbean.vn', amaRole: 'MANAGER' },
  { amaUserId: '00000000-0000-0000-0000-00000000a003', name: 'Minh Tran', email: 'minh.tran@socialbean.vn', amaRole: 'MEMBER' },
  { amaUserId: '00000000-0000-0000-0000-00000000a004', name: 'An Le', email: 'an.le@socialbean.vn', amaRole: 'MEMBER' },
  { amaUserId: '00000000-0000-0000-0000-00000000a005', name: 'Phuong Bui', email: 'phuong.bui@socialbean.vn', amaRole: 'MEMBER' },
  { amaUserId: '00000000-0000-0000-0000-00000000a006', name: 'Khanh Vo', email: 'khanh.vo@socialbean.vn', amaRole: 'MEMBER' },
];

export function getAmaMockMembers(): UserRow[] {
  const baseDate = new Date('2026-04-01T08:00:00Z').getTime();
  return MOCK_AMA_MEMBERS.map((member, i) => ({
    usrId: `mock-${member.amaUserId}`,
    amaUserId: member.amaUserId,
    email: member.email,
    name: member.name,
    role: 'UNASSIGNED',
    amaRoleSnapshot: member.amaRole,
    status: 'INACTIVE',
    loginCount: 0,
    mfaLastAt: null,
    lastLoginAt: null,
    createdAt: new Date(baseDate + i * 86_400_000).toISOString(),
  }));
}
