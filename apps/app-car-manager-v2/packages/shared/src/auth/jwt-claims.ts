import { z } from 'zod';

// AMA's `generateAppToken` (in ambManagement) signs with this exact payload:
//   { sub, email, role, entityId, appId, appCode, scope, iat, exp }
// — camelCase, no `iss`/`aud`, and `appCode` carries the `eca_code` value
// which is `app-car-manager-v2` (catalog slug, with prefix). v2 internals
// prefer snake_case + the slug without prefix, so we accept the AMA shape
// and normalize via Zod transform.
const AMA_APP_CODE = 'app-car-manager-v2';
const LOCAL_APP_CODE = 'car-manager-v2';

export const amaJwtClaimsSchema = z
  .object({
    sub: z.string().uuid(),
    entityId: z.string().uuid(),
    /* AMA-issued entity display name. Optional for forward compatibility:
     * older tokens minted before AMA adds this claim simply don't carry it,
     * and the app falls back to the DB-stored tenant name or a default. */
    entityName: z.string().optional(),
    role: z.enum(['OWNER', 'MASTER', 'MANAGER', 'MEMBER']),
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
    ent_name: claims.entityName,
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
      return 'ADMIN';
    case 'MANAGER':
      return 'MANAGER';
    case 'MEMBER':
      return 'DRIVER';
  }
}
