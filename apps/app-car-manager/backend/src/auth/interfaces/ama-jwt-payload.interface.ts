export interface AmaJwtPayload {
  // AMA JWT standard claims
  sub: string;          // user ID (AMA JWT 'sub' claim)
  ent_id: string;       // entity ID (AMA JWT 'ent_id' claim)
  ent_code: string;     // entity code
  email: string;
  name: string;
  roles: string[];
  iat: number;
  exp: number;
  // Aliases (mapped from JWT)
  userId: string;
  entityId: string;
  entityCode: string;
}
