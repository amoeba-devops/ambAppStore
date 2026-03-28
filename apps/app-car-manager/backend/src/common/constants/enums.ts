export enum VehicleType {
  PASSENGER = 'PASSENGER',
  VAN = 'VAN',
  TRUCK = 'TRUCK',
}

export enum FuelType {
  GASOLINE = 'GASOLINE',
  DIESEL = 'DIESEL',
  LPG = 'LPG',
  ELECTRIC = 'ELECTRIC',
  HYBRID = 'HYBRID',
}

export enum TransmissionType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

export enum CargoType {
  CARGO = 'CARGO',
  TOP = 'TOP',
  FROZEN_TOP = 'FROZEN_TOP',
  WING = 'WING',
}

export enum PurchaseType {
  OWNED = 'OWNED',
  LEASE = 'LEASE',
  INSTALLMENT = 'INSTALLMENT',
}

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  DISPOSED = 'DISPOSED',
}

export enum ManagerRole {
  ADMIN_MANAGER = 'ADMIN_MANAGER',
  MAINTENANCE_MGR = 'MAINTENANCE_MGR',
}

export enum DriverRole {
  PRIMARY_DRIVER = 'PRIMARY_DRIVER',
  SUB_DRIVER = 'SUB_DRIVER',
  POOL_DRIVER = 'POOL_DRIVER',
}

export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  INACTIVE = 'INACTIVE',
}

export enum DispatchPurposeType {
  BUSINESS = 'BUSINESS',
  CLIENT = 'CLIENT',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DRIVER_ACCEPTED = 'DRIVER_ACCEPTED',
  DRIVER_REJECTED = 'DRIVER_REJECTED',
  DEPARTED = 'DEPARTED',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TripLogStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VERIFIED = 'VERIFIED',
}

export enum KrPurposeCode {
  BUSINESS = 'BUSINESS',
  COMMUTE = 'COMMUTE',
  OTHER = 'OTHER',
}

export enum MaintenanceType {
  REGULAR = 'REGULAR',
  TIRE = 'TIRE',
  OIL = 'OIL',
  BRAKE = 'BRAKE',
  INSURANCE = 'INSURANCE',
  INSPECTION = 'INSPECTION',
  OTHER = 'OTHER',
}
