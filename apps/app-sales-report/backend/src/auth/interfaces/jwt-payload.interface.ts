export interface DrdJwtPayload {
  sub: string;           // usr_id (UUID)
  ent_id: string | null; // Entity ID — SYSTEM_ADMIN: null
  crp_code: string | null;
  role: string;
  name: string;
  temp_password: boolean;
  source: 'AMA_SSO' | 'DIRECT';
  iat?: number;
  exp?: number;
}
