import { z } from 'zod';

// AMA's `generateAppToken` (in ambManagement, via iframe-token.service) signs
// with this exact payload:
//   { sub, email, role, entityId, appId, appCode, scope, iat, exp }
// — camelCase, NO `iss`/`aud`, and `appCode` carries the `eca_code` value.
// Depending on how the entity was registered in `amb_entity_custom_apps`, the
// code may be the catalog slug `app-sales-report-v2` or the bare
// `sales-report-v2`, so we accept both. v2 internals prefer snake_case + the
// bare slug, so we normalize the AMA shape via a Zod transform.
const AMA_APP_CODE = 'app-sales-report-v2';
const LOCAL_APP_CODE = 'sales-report-v2';

export const amaJwtClaimsSchema = z
  .object({
    sub: z.string().uuid(),
    entityId: z.string().uuid(),
    /* AMA-issued entity display name. Optional for forward compatibility:
     * older tokens minted before AMA adds this claim simply don't carry it. */
    entityName: z.string().optional(),
    /* Wider role enum: AMA's amb_hr_entity_user_roles.eur_role can carry
     * ADMIN/SUPER_ADMIN/VIEWER beyond the 4 base roles (e.g. an ADMIN_LEVEL
     * system admin assigned to an entity). Map via mapAmaRoleToLocal. */
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
    ent_name: claims.entityName,
    role: claims.role,
    email: claims.email,
    name: claims.name,
    app_code: LOCAL_APP_CODE as typeof LOCAL_APP_CODE,
    iat: claims.iat,
    exp: claims.exp,
  }));

export type AmaJwtClaims = z.infer<typeof amaJwtClaimsSchema>;

export type LocalRole = 'OPERATOR' | 'MANAGER' | 'ADMIN';

export function mapAmaRoleToLocal(amaRole: AmaJwtClaims['role'] | (string & {})): LocalRole {
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
      return 'OPERATOR';
    default:
      // Bulk-sync feeds raw role strings straight from AMA's
      // /entity-settings/members API, so guard any role AMA might add later —
      // lowest privilege (OPERATOR) instead of an undefined local role.
      return 'OPERATOR';
  }
}
