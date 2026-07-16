/**
 * Minimal actor context for core domain services. The app's full AuthContext
 * (apps/web/src/lib/auth/get-current-user.ts) is structurally assignable to
 * this — core stays framework-agnostic and never imports next/* or app code.
 *
 * Role / fleet permission checks happen in the app action layer (requireRole,
 * requireFleet) BEFORE calling these services; core only ent-scopes its queries
 * as defense-in-depth.
 */
export interface FleetActor {
  entId: string;
  userId: string;
}
