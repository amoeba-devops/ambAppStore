export interface AsmJwtPayload {
  sub: string;           // usr_id (UUID)
  ent_id: string | null; // crp_id — SYSTEM_ADMIN: null
  crp_code: string | null; // Corporation Code
  role: string;          // UserRole enum value
  name: string;          // usr_name
  temp_password: boolean;
  source: 'AMA_SSO' | 'DIRECT';
  iat?: number;
  exp?: number;
}
