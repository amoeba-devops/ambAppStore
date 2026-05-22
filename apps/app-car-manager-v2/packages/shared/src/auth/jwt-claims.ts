import { z } from 'zod';

// AMA's `generateAppToken` (in ambManagement) signs with this exact payload:
//   { sub, email, role, entityId, appId, appCode, scope, iat, exp }
// — camelCase, no `iss`/`aud`, and `appCode` carries the `eca_code` value
// which is `app-car-manager-v2` (catalog slug, with prefix). v2 internals
// prefer snake_case + the slug without prefix, so we accept the AMA shape
// and normalize via Zod transform.
const AMA_APP_CODE = 'app-car-manager-v2';
const LOCAL_APP_CODE = 'car-manager-v2';

/**
 * Entity-scoped role from amb_hr_entity_user_roles.eur_role.
 * AMA's actual data also uses 'ADMIN' / 'SUPER_ADMIN' / 'VIEWER' for some users
 * (e.g. ADMIN_LEVEL system admin assigned to entities). v2 only knows 3 local
 * roles (DRIVER/MANAGER/ADMIN) so we map the wider AMA enum:
 *   OWNER, MASTER, ADMIN, SUPER_ADMIN → ADMIN
 *   MANAGER → MANAGER
 *   MEMBER, VIEWER → DRIVER (VIEWER read-only, treated as driver-tier)
 */
export const amaJwtClaimsSchema = z
  .object({
    sub: z.string().uuid(),
    entityId: z.string().uuid(),
    role: z.enum(['OWNER', 'MASTER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
    email: z.string().email().optional(),
    name: z.string().optional(),
    appCode: z.union([z.literal(AMA_APP_CODE), z.literal(LOCAL_APP_CODE)]),
    appId: z.string().uuid().optional(),
    scope: z.string().optional(),
    iat: z.number(),
    exp: z.number(),
  })
  .transform((claims) => ({
    sub: claims.sub,
    ent_id: claims.entityId,
    role: claims.role,
    email: claims.email,
    name: claims.name,
    app_code: LOCAL_APP_CODE as typeof LOCAL_APP_CODE,
    iat: claims.iat,
    exp: claims.exp,
  }));

export type AmaJwtClaims = z.infer<typeof amaJwtClaimsSchema>;

/** App-local roles per PRD §4 (Admin/Manager/Driver). */
export type LocalRole = 'DRIVER' | 'MANAGER' | 'ADMIN';

export function mapAmaRoleToLocal(amaRole: AmaJwtClaims['role']): LocalRole {
  switch (amaRole) {
    case 'OWNER':
    case 'MASTER':
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return 'ADMIN';
    case 'MANAGER':
      return 'MANAGER';
    case 'MEMBER':
    case 'VIEWER':
      return 'DRIVER';
  }
}
