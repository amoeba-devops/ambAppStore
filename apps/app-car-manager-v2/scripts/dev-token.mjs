import { SignJWT } from 'jose';

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET is required (set in .env)');
  process.exit(1);
}

const role = process.argv[2] ?? 'OWNER';
const validRoles = ['OWNER', 'MASTER', 'MANAGER', 'MEMBER'];
if (!validRoles.includes(role)) {
  console.error(`Invalid role "${role}". Use one of: ${validRoles.join(', ')}`);
  process.exit(1);
}

const baseUrl = process.env.DEV_WEB_URL ?? 'http://localhost:3001';
const key = new TextEncoder().encode(secret);

/* Map URL role alias → AMA JWT role. AMA OwnEntityGuard only accepts
 * MASTER/ADMIN for USER_LEVEL → OWNER literal → 403. See dev-login route. */
const URL_TO_JWT_ROLE = { OWNER: 'MASTER', MASTER: 'MASTER', MANAGER: 'MANAGER', MEMBER: 'MEMBER' };
const SUB_BY_ROLE = {
  OWNER:   '00000000-0000-4000-8000-000000000001',
  MASTER:  '00000000-0000-4000-8000-000000000001',
  MANAGER: '00000000-0000-4000-8000-000000000002',
  MEMBER:  '00000000-0000-4000-8000-000000000003',
};

const token = await new SignJWT({
  sub: SUB_BY_ROLE[role],
  entityId: '00000000-0000-4000-8000-000000000010',
  role: URL_TO_JWT_ROLE[role],
  email: `dev-${role.toLowerCase()}@dev.car-manager-v2.local`,
  name: `Dev ${role}`,
  appCode: 'app-car-manager-v2',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('8h')
  .sign(key);

const localRole =
  role === 'OWNER' || role === 'MASTER' ? 'ADMIN' : role === 'MANAGER' ? 'MANAGER' : 'DRIVER';

console.log('Dev login URL (open in browser, valid 8h):');
console.log('');
console.log(`  ${baseUrl}/?ama_token=${token}`);
console.log('');
console.log(`Role: ${role}  →  local: ${localRole}`);
console.log('Other roles: OWNER (default) | MASTER | MANAGER | MEMBER');
console.log('  Usage: npm run dev:token -- MANAGER');
