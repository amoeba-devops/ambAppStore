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

const token = await new SignJWT({
  sub: '00000000-0000-0000-0000-000000000001',
  entityId: '00000000-0000-0000-0000-000000000010',
  role,
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
