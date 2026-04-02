// ===== User =====
export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
}

// ===== Corporation =====
export enum CorporationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

// ===== Channel =====
export enum ChannelType {
  MARKETPLACE = 'MARKETPLACE',
  OWN = 'OWN',
  B2B = 'B2B',
  OFFLINE = 'OFFLINE',
  INFLUENCER = 'INFLUENCER',
}

// ===== CM Status =====
export enum CmStatus {
  NORMAL = 'NORMAL',
  NEGATIVE = 'NEGATIVE',
  SKU_UNMAPPED = 'SKU_UNMAPPED',
  PRIME_COST_MISSING = 'PRIME_COST_MISSING',
  INCOMPLETE = 'INCOMPLETE',
}
