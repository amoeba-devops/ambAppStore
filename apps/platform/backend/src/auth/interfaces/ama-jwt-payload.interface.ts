export interface AmaJwtPayload {
  sub?: string;
  userId: string;
  entityId: string;
  entityCode: string;
  email: string;
  name: string;
  level?: string;
  role?: string;
  roles: string[];
  iat: number;
  exp: number;
}
