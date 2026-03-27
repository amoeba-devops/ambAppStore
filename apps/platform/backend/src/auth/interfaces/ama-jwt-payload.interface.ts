export interface AmaJwtPayload {
  userId: string;
  entityId: string;
  entityCode: string;
  email: string;
  name: string;
  roles: string[];
  iat: number;
  exp: number;
}
