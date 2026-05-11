import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, type DbUser } from '@/lib/db/schema';
import type { CreateUserInput, Role, UpdateUserInput, UserStatus } from '@repo/api-types';
import { HttpError } from '@/lib/api/response';
import { hashPassword } from '@/lib/auth/password';

export async function listUsers(filter?: {
  role?: Role;
  status?: UserStatus;
  q?: string;
}): Promise<DbUser[]> {
  const conds = [];
  if (filter?.role) conds.push(eq(users.role, filter.role));
  if (filter?.status) conds.push(eq(users.status, filter.status));
  if (filter?.q) {
    conds.push(or(ilike(users.fullName, `%${filter.q}%`), ilike(users.email, `%${filter.q}%`))!);
  }
  return db
    .select()
    .from(users)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(users.fullName);
}

export async function getUser(id: string): Promise<DbUser | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function createUser(input: CreateUserInput): Promise<DbUser> {
  const passwordHash = await hashPassword(input.password);
  const [created] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      position: input.position ?? null,
      role: input.role,
      language: input.language ?? 'en',
      status: 'ACTIVE',
    })
    .returning();
  if (!created) throw new HttpError(500, 'INSERT_FAILED', 'Failed to create user');
  return created;
}

export async function updateUser(id: string, patch: UpdateUserInput & { status?: UserStatus }): Promise<DbUser> {
  const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!current) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');

  const [updated] = await db
    .update(users)
    .set({
      email: patch.email ?? current.email,
      fullName: patch.fullName ?? current.fullName,
      position: patch.position !== undefined ? patch.position ?? null : current.position,
      role: patch.role ?? current.role,
      language: patch.language ?? current.language,
      status: patch.status ?? current.status,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();
  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to update user');
  return updated;
}

export async function setUserPassword(id: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

export function toUserResponse(u: DbUser) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    position: u.position,
    role: u.role,
    language: u.language,
    status: u.status,
    ssoProvider: u.ssoProvider,
    ssoId: u.ssoId,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
