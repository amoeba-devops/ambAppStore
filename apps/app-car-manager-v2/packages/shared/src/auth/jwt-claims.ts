import { z } from 'zod';

export const amaJwtClaimsSchema = z.object({
  sub: z.string().uuid(),
  ent_id: z.string().uuid(),
  role: z.enum(['OWNER', 'MASTER', 'MANAGER', 'MEMBER']),
  email: z.string().email().optional(),
  name: z.string().optional(),
  app_code: z.literal('car-manager-v2'),
  iat: z.number(),
  exp: z.number(),
  iss: z.literal('amb-management'),
  aud: z.literal('car-manager-v2'),
});

export type AmaJwtClaims = z.infer<typeof amaJwtClaimsSchema>;

/** App-local roles per PRD §4 (Admin/Manager/Driver). */
export type LocalRole = 'DRIVER' | 'MANAGER' | 'ADMIN';

export function mapAmaRoleToLocal(amaRole: AmaJwtClaims['role']): LocalRole {
  switch (amaRole) {
    case 'OWNER':
    case 'MASTER':
      return 'ADMIN';
    case 'MANAGER':
      return 'MANAGER';
    case 'MEMBER':
      return 'DRIVER';
  }
}
