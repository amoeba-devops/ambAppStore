import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  costAttachments,
  costs,
  systemSettings,
  trips,
  users,
  vehicles,
  type DbCost,
} from '@/lib/db/schema';
import {
  AccidentMetadataSchema,
  FuelMetadataSchema,
  MealMetadataSchema,
  OilChangeMetadataSchema,
  RepairMaintenanceMetadataSchema,
  type CostStatus,
  type CostType,
} from '@repo/api-types';
import { HttpError } from '@/lib/api/response';

// ============================================================================
// Settings / thresholds
// ============================================================================
async function readNumberSetting(key: string, fallback: number): Promise<number> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  if (typeof row?.value === 'number') return row.value;
  return fallback;
}

async function loadAutoApproveThreshold(type: CostType): Promise<number | null> {
  // ACCIDENT and REPAIR_MAINTENANCE never auto-approve (PRD BR-10).
  if (type === 'ACCIDENT' || type === 'REPAIR_MAINTENANCE') return null;
  switch (type) {
    case 'FUEL':
      return readNumberSetting('auto_approve_threshold_fuel', 1_000_000);
    case 'MEAL':
      return readNumberSetting('auto_approve_threshold_meal', 500_000);
    case 'OIL_CHANGE':
      return readNumberSetting('auto_approve_threshold_oil', 2_000_000);
    default:
      return null;
  }
}

// ============================================================================
// Validation per type (PRD §5.5 + BR-08, BR-09, BR-11)
// ============================================================================
function validateMetadata(
  type: CostType,
  metadata: Record<string, unknown>,
  amount: number,
  tripId: string | null,
): void {
  switch (type) {
    case 'FUEL': {
      const parsed = FuelMetadataSchema.parse(metadata);
      // BR-11: amount must equal liters * unitPrice (allow 0.01 tolerance)
      const expected = parsed.liters * parsed.unitPrice;
      if (Math.abs(expected - amount) > 1) {
        throw new HttpError(
          400,
          'AMOUNT_MISMATCH',
          `Fuel amount (${amount}) must equal liters × unitPrice (${expected})`,
        );
      }
      return;
    }
    case 'OIL_CHANGE':
      OilChangeMetadataSchema.parse(metadata);
      return;
    case 'ACCIDENT':
      AccidentMetadataSchema.parse(metadata);
      return;
    case 'MEAL':
      MealMetadataSchema.parse(metadata);
      // BR-09: MEAL must have tripId
      if (!tripId) throw new HttpError(400, 'TRIP_ID_REQUIRED', 'Meal cost must be linked to a trip');
      return;
    case 'REPAIR_MAINTENANCE':
      RepairMaintenanceMetadataSchema.parse(metadata);
      return;
  }
}

// ============================================================================
// Pre-condition checks
// ============================================================================
async function assertTripCompatible(tripId: string | null, vehicleId: string) {
  if (!tripId) return;
  const [t] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!t) throw new HttpError(400, 'TRIP_NOT_FOUND', 'Linked trip not found');
  if (t.vehicleId !== vehicleId) {
    throw new HttpError(400, 'TRIP_VEHICLE_MISMATCH', 'Trip does not belong to this vehicle');
  }
  if (t.status === 'CANCELLED') {
    throw new HttpError(400, 'TRIP_CANCELLED', 'Cannot attach cost to a cancelled trip');
  }
}

// ============================================================================
// Create
// ============================================================================
export type CreateCostArgs = {
  type: CostType;
  vehicleId: string;
  tripId?: string;
  costDate: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata: Record<string, unknown>;
  submittedBy: string;
  /** If true, create as PENDING_APPROVAL (pre-approval flow for REPAIR/ACCIDENT). */
  preApproval?: boolean;
};

export async function createCost(args: CreateCostArgs): Promise<DbCost> {
  // Vehicle must exist
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, args.vehicleId)).limit(1);
  if (!v) throw new HttpError(400, 'VEHICLE_NOT_FOUND', 'Vehicle not found');

  validateMetadata(args.type, args.metadata, args.amount, args.tripId ?? null);
  await assertTripCompatible(args.tripId ?? null, args.vehicleId);

  // Decide initial status
  let status: CostStatus;
  if (args.preApproval && (args.type === 'REPAIR_MAINTENANCE' || args.type === 'ACCIDENT')) {
    status = 'PENDING_APPROVAL';
  } else {
    const threshold = await loadAutoApproveThreshold(args.type);
    if (threshold !== null && args.amount <= threshold) {
      status = 'APPROVED';
    } else {
      status = 'SUBMITTED';
    }
  }

  const [created] = await db
    .insert(costs)
    .values({
      type: args.type,
      vehicleId: args.vehicleId,
      tripId: args.tripId ?? null,
      costDate: args.costDate,
      amount: String(args.amount),
      currency: args.currency ?? 'VND',
      description: args.description ?? null,
      metadata: args.metadata,
      status,
      submittedBy: args.submittedBy,
      approvedBy: status === 'APPROVED' ? args.submittedBy : null,
      approvedAt: status === 'APPROVED' ? new Date() : null,
    })
    .returning();

  if (!created) throw new HttpError(500, 'INSERT_FAILED', 'Failed to create cost');
  return created;
}

// ============================================================================
// List + Get
// ============================================================================
export type CostFilter = {
  type?: CostType;
  vehicleId?: string;
  tripId?: string;
  status?: CostStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export async function listCosts(filter: CostFilter, viewer: { userId: string; role: 'ADMIN' | 'MANAGER' | 'DRIVER' }) {
  const conds = [];
  if (filter.type) conds.push(eq(costs.type, filter.type));
  if (filter.vehicleId) conds.push(eq(costs.vehicleId, filter.vehicleId));
  if (filter.tripId) conds.push(eq(costs.tripId, filter.tripId));
  if (filter.status) conds.push(eq(costs.status, filter.status));
  if (filter.from) conds.push(gte(costs.costDate, filter.from));
  if (filter.to) conds.push(lte(costs.costDate, filter.to));

  // Authorization: Driver only sees own submissions; Manager sees own; Admin all.
  if (viewer.role === 'DRIVER' || viewer.role === 'MANAGER') {
    conds.push(eq(costs.submittedBy, viewer.userId));
  }

  const where = conds.length > 0 ? and(...conds) : undefined;
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const offset = (page - 1) * limit;

  const [items, totalRows] = await Promise.all([
    db
      .select({
        cost: costs,
        licensePlate: vehicles.licensePlate,
        submitterName: users.fullName,
      })
      .from(costs)
      .innerJoin(vehicles, eq(vehicles.id, costs.vehicleId))
      .innerJoin(users, eq(users.id, costs.submittedBy))
      .where(where)
      .orderBy(desc(costs.costDate), desc(costs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(costs).where(where),
  ]);

  return { items, total: totalRows[0]?.count ?? 0 };
}

export async function getCost(id: string) {
  const [row] = await db
    .select({
      cost: costs,
      vehicle: { id: vehicles.id, licensePlate: vehicles.licensePlate, vehicleType: vehicles.vehicleType },
      submitter: { id: users.id, fullName: users.fullName, email: users.email },
    })
    .from(costs)
    .innerJoin(vehicles, eq(vehicles.id, costs.vehicleId))
    .innerJoin(users, eq(users.id, costs.submittedBy))
    .where(eq(costs.id, id))
    .limit(1);

  if (!row) return null;

  const attachments = await db
    .select()
    .from(costAttachments)
    .where(eq(costAttachments.costId, id));

  return { ...row, attachments };
}

// ============================================================================
// Update / Delete
// ============================================================================
export async function updateCost(
  id: string,
  patch: Partial<CreateCostArgs>,
  actor: { userId: string; role: 'ADMIN' | 'MANAGER' | 'DRIVER' },
): Promise<DbCost> {
  const [current] = await db.select().from(costs).where(eq(costs.id, id)).limit(1);
  if (!current) throw new HttpError(404, 'COST_NOT_FOUND', 'Cost not found');

  // BR-12: APPROVED cost cannot be edited unless Admin "unlock"
  if (current.status === 'APPROVED' && actor.role !== 'ADMIN') {
    throw new HttpError(403, 'COST_LOCKED', 'Approved costs cannot be edited');
  }
  // Only DRAFT or REJECTED are editable per PRD
  if (!['DRAFT', 'REJECTED', 'PENDING_APPROVAL'].includes(current.status) && actor.role !== 'ADMIN') {
    throw new HttpError(403, 'NOT_EDITABLE', 'Cost cannot be edited in current state');
  }
  if (actor.role !== 'ADMIN' && current.submittedBy !== actor.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only edit your own submissions');
  }

  const newAmount = patch.amount ?? Number(current.amount);
  const newType = patch.type ?? current.type;
  const newMetadata = patch.metadata ?? (current.metadata as Record<string, unknown>);
  const newTripId = patch.tripId ?? current.tripId;
  validateMetadata(newType, newMetadata, newAmount, newTripId);

  const [updated] = await db
    .update(costs)
    .set({
      type: newType,
      vehicleId: patch.vehicleId ?? current.vehicleId,
      tripId: patch.tripId !== undefined ? patch.tripId ?? null : current.tripId,
      costDate: patch.costDate ?? current.costDate,
      amount: String(newAmount),
      currency: patch.currency ?? current.currency,
      description: patch.description !== undefined ? patch.description ?? null : current.description,
      metadata: newMetadata,
      updatedAt: new Date(),
    })
    .where(eq(costs.id, id))
    .returning();

  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to update cost');
  return updated;
}

export async function deleteCost(id: string): Promise<void> {
  await db.delete(costs).where(eq(costs.id, id));
}

// ============================================================================
// Status transitions
// ============================================================================
async function loadCostOrThrow(id: string): Promise<DbCost> {
  const [c] = await db.select().from(costs).where(eq(costs.id, id)).limit(1);
  if (!c) throw new HttpError(404, 'COST_NOT_FOUND', 'Cost not found');
  return c;
}

export async function submitCost(id: string, actor: { userId: string; role: 'ADMIN' | 'MANAGER' | 'DRIVER' }) {
  const current = await loadCostOrThrow(id);
  if (actor.role !== 'ADMIN' && current.submittedBy !== actor.userId) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only submit your own costs');
  }
  if (!['DRAFT', 'APPROVED_TO_PROCEED'].includes(current.status)) {
    throw new HttpError(409, 'INVALID_TRANSITION', `Cannot submit cost in status ${current.status}`);
  }

  // After actual amount/receipts are set: re-evaluate auto-approve threshold
  let nextStatus: CostStatus = 'SUBMITTED';
  if (current.status === 'DRAFT') {
    const threshold = await loadAutoApproveThreshold(current.type);
    if (threshold !== null && Number(current.amount) <= threshold) {
      nextStatus = 'APPROVED';
    }
  }

  const [updated] = await db
    .update(costs)
    .set({
      status: nextStatus,
      approvedBy: nextStatus === 'APPROVED' ? actor.userId : null,
      approvedAt: nextStatus === 'APPROVED' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(costs.id, id))
    .returning();

  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to submit cost');
  return updated;
}

export async function approveCost(id: string, approverId: string) {
  const current = await loadCostOrThrow(id);
  if (!['SUBMITTED', 'PENDING_APPROVAL'].includes(current.status)) {
    throw new HttpError(409, 'INVALID_TRANSITION', `Cannot approve cost in status ${current.status}`);
  }

  // PENDING_APPROVAL → APPROVED_TO_PROCEED (pre-approval workflow)
  // SUBMITTED → APPROVED (post-approval)
  const nextStatus: CostStatus =
    current.status === 'PENDING_APPROVAL' ? 'APPROVED_TO_PROCEED' : 'APPROVED';

  const [updated] = await db
    .update(costs)
    .set({
      status: nextStatus,
      approvedBy: approverId,
      approvedAt: new Date(),
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(costs.id, id))
    .returning();

  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to approve cost');
  return updated;
}

export async function rejectCost(id: string, approverId: string, reason: string) {
  const current = await loadCostOrThrow(id);
  if (!['SUBMITTED', 'PENDING_APPROVAL'].includes(current.status)) {
    throw new HttpError(409, 'INVALID_TRANSITION', `Cannot reject cost in status ${current.status}`);
  }
  const [updated] = await db
    .update(costs)
    .set({
      status: 'REJECTED',
      approvedBy: approverId,
      approvedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(costs.id, id))
    .returning();

  if (!updated) throw new HttpError(500, 'UPDATE_FAILED', 'Failed to reject cost');
  return updated;
}

// ============================================================================
// Response mapping
// ============================================================================
export function toCostResponse(c: DbCost) {
  return {
    id: c.id,
    type: c.type,
    vehicleId: c.vehicleId,
    tripId: c.tripId,
    costDate: c.costDate,
    amount: c.amount,
    currency: c.currency,
    description: c.description,
    metadata: c.metadata,
    status: c.status,
    rejectionReason: c.rejectionReason,
    submittedBy: c.submittedBy,
    approvedBy: c.approvedBy,
    approvedAt: c.approvedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
