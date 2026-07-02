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
 * The full set of entity-scoped roles AMA can issue
 * (`amb_hr_entity_user_roles.eur_role`). All 7 are preserved verbatim in
 * `car_users.usr_ama_role_snapshot`; the app collapses them to 3 local
 * permission tiers via {@link mapAmaRoleToLocal}. Single source of truth for
 * both the JWT enum and UI label lookups.
 */
export const AMA_ROLES = [
  'OWNER',
  'MASTER',
  'ADMIN',
  'SUPER_ADMIN',
  'MANAGER',
  'MEMBER',
  'VIEWER',
] as const;

export type AmaRole = (typeof AMA_ROLES)[number];

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
    /* AMA-issued entity display name. Optional for forward compatibility:
     * older tokens minted before AMA adds this claim simply don't carry it,
     * and the app falls back to the DB-stored tenant name or a default. */
    entityName: z.string().optional(),
    /* Wider role enum: AMA's amb_hr_entity_user_roles.eur_role có thể carry
     * ADMIN/SUPER_ADMIN/VIEWER ngoài 4 base. Map via mapAmaRoleToLocal. */
    role: z.enum(AMA_ROLES),
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

/**
 * Map AMA role → 3-tier local permission. The full AMA role is preserved
 * verbatim in `car_users.usr_ama_role_snapshot` (so all 7 roles "đồng bộ qua"
 * for display); this only collapses them into the app's permission tier.
 *
 * `amaRole` is typed to the 7-enum, but the bulk-sync path feeds raw strings
 * straight from AMA's `/entity-settings/members` API — so a `default` guards
 * any role AMA might add later, ensuring EVERY member still syncs (lowest
 * privilege = DRIVER) instead of crashing with an undefined local role.
 */
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
      return 'DRIVER';
    default:
      return 'DRIVER';
  }
}
