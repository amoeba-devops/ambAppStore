// ===== Corporation =====
export enum CorporationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

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

// ===== User Application =====
export enum UapStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// ===== Product / SKU =====
export enum SkuStatus {
  PENDING_IN = 'PENDING_IN',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED',
}

export enum IdCodeType {
  BARCODE = 'BARCODE',
  INTERNAL = 'INTERNAL',
  SUPPLIER = 'SUPPLIER',
  HSCODE = 'HSCODE',
  UPC = 'UPC',
  EAN = 'EAN',
}

// ===== Transaction =====
export enum TransactionType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TransactionReason {
  PURCHASE = 'PURCHASE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  SALES = 'SALES',
  DAMAGE = 'DAMAGE',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

// ===== Receiving Schedule =====
export enum ReceivingStatus {
  EXPECTED = 'EXPECTED',
  ARRIVED = 'ARRIVED',
  INSPECTING = 'INSPECTING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum InspectionResult {
  PASS = 'PASS',
  PARTIAL = 'PARTIAL',
  FAIL = 'FAIL',
}

// ===== Sales Order =====
export enum SalesOrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum SalesChannel {
  B2C = 'B2C',
  B2B = 'B2B',
}

// ===== Order Batch =====
export enum OrderBatchStatus {
  PROPOSED = 'PROPOSED',
  ADJUSTED = 'ADJUSTED',
  APPROVED = 'APPROVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum UrgencyLevel {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL',
}
