'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@car-v2/db/client';
import {
  carTrips,
  carExpenses,
  carUsers,
  carVehicles,
  type CarTripStatus,
  type CarExpenseStatus,
  type CarExpenseType,
} from '@car-v2/db/schema';
import type { ActionResult } from '@car-v2/shared/errors';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export interface TripDetailData {
  id: string;
  ref: string;
  status: CarTripStatus;
  scheduledAt: string;
  pickupAddress: string;
  dropoffAddress: string;
  purpose: string | null;
  passengerName: string | null;
  vehiclePlate: string | null;
}

export interface ExpenseDetailData {
  id: string;
  expenseType: CarExpenseType;
  status: CarExpenseStatus;
  amount: string;
  currency: string;
  occurredAt: string;
  note: string | null;
  vehiclePlate: string | null;
}

export type RefDetailData =
  | { type: 'trip'; trip: TripDetailData }
  | { type: 'expense'; expense: ExpenseDetailData };

/**
 * Fetch detail data for a trip or expense ref.
 * Used in the delete warning detail panel.
 */
export async function getRefDetailAction(
  refType: string,
  refId: string,
): Promise<ActionResult<RefDetailData>> {
  try {
    const actor = await getCurrentUser();

    if (refType === 'active_trips') {
      const result = await db
        .select({
          trpId: carTrips.trpId,
          trpRef: carTrips.trpRef,
          trpStatus: carTrips.trpStatus,
          trpScheduledAt: carTrips.trpScheduledAt,
          trpPickupAddress: carTrips.trpPickupAddress,
          trpDropoffAddress: carTrips.trpDropoffAddress,
          trpPurpose: carTrips.trpPurpose,
          passengerName: carUsers.usrName,
          vehiclePlate: carVehicles.cvhPlateNumber,
        })
        .from(carTrips)
        .leftJoin(carUsers, eq(carTrips.trpPassengerId, carUsers.usrId))
        .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
        .where(
          and(
            eq(carTrips.trpId, refId),
            eq(carTrips.entId, actor.entId),
            isNull(carTrips.trpDeletedAt),
          ),
        )
        .limit(1);

      const row = result[0];
      if (!row) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } };
      }

      return {
        success: true,
        data: {
          type: 'trip',
          trip: {
            id: row.trpId,
            ref: row.trpRef,
            status: row.trpStatus,
            scheduledAt: row.trpScheduledAt.toISOString(),
            pickupAddress: row.trpPickupAddress,
            dropoffAddress: row.trpDropoffAddress,
            purpose: row.trpPurpose,
            passengerName: row.passengerName,
            vehiclePlate: row.vehiclePlate,
          },
        },
      };
    }

    // Support both 'pending_expenses' (driver delete) and 'linked_expenses' (vehicle delete)
    if (refType === 'pending_expenses' || refType === 'linked_expenses') {
      const result = await db
        .select({
          expId: carExpenses.expId,
          expType: carExpenses.expType,
          expStatus: carExpenses.expStatus,
          expAmount: carExpenses.expAmount,
          expCurrency: carExpenses.expCurrency,
          expOccurredAt: carExpenses.expOccurredAt,
          expNote: carExpenses.expNote,
          vehiclePlate: carVehicles.cvhPlateNumber,
        })
        .from(carExpenses)
        .leftJoin(carVehicles, eq(carExpenses.expVehicleId, carVehicles.cvhId))
        .where(
          and(
            eq(carExpenses.expId, refId),
            eq(carExpenses.entId, actor.entId),
            isNull(carExpenses.expDeletedAt),
          ),
        )
        .limit(1);

      const row = result[0];
      if (!row) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } };
      }

      return {
        success: true,
        data: {
          type: 'expense',
          expense: {
            id: row.expId,
            expenseType: row.expType,
            status: row.expStatus,
            amount: row.expAmount,
            currency: row.expCurrency,
            occurredAt: row.expOccurredAt,
            note: row.expNote,
            vehiclePlate: row.vehiclePlate,
          },
        },
      };
    }

    // Support 'linked_trip' type for expense delete warnings
    if (refType === 'linked_trip') {
      const result = await db
        .select({
          trpId: carTrips.trpId,
          trpRef: carTrips.trpRef,
          trpStatus: carTrips.trpStatus,
          trpScheduledAt: carTrips.trpScheduledAt,
          trpPickupAddress: carTrips.trpPickupAddress,
          trpDropoffAddress: carTrips.trpDropoffAddress,
          trpPurpose: carTrips.trpPurpose,
          passengerName: carUsers.usrName,
          vehiclePlate: carVehicles.cvhPlateNumber,
        })
        .from(carTrips)
        .leftJoin(carUsers, eq(carTrips.trpPassengerId, carUsers.usrId))
        .leftJoin(carVehicles, eq(carTrips.trpVehicleId, carVehicles.cvhId))
        .where(
          and(
            eq(carTrips.trpId, refId),
            eq(carTrips.entId, actor.entId),
            isNull(carTrips.trpDeletedAt),
          ),
        )
        .limit(1);

      const row = result[0];
      if (!row) {
        return { success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } };
      }

      return {
        success: true,
        data: {
          type: 'trip',
          trip: {
            id: row.trpId,
            ref: row.trpRef,
            status: row.trpStatus,
            scheduledAt: row.trpScheduledAt.toISOString(),
            pickupAddress: row.trpPickupAddress,
            dropoffAddress: row.trpDropoffAddress,
            purpose: row.trpPurpose,
            passengerName: row.passengerName,
            vehiclePlate: row.vehiclePlate,
          },
        },
      };
    }

    return { success: false, error: { code: 'INVALID_TYPE', message: 'Unknown ref type' } };
  } catch (error) {
    console.error('getRefDetailAction error:', error);
    return { success: false, error: { code: 'INTERNAL', message: 'Failed to fetch details' } };
  }
}
