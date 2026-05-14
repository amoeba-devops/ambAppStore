export interface AmaJwtPayload {
  sub: string;
  ent_id: string;
  ent_code: string;
  email: string;
  name: string;
  roles: string[];
  iat: number;
  exp: number;
  userId: string;
  entityId: string;
  entityCode: string;
}
