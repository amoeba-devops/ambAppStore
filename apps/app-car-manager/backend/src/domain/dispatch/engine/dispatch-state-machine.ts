import { DispatchStatus } from '../../../common/constants/enums';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

/**
 * 배차 상태 전이 규칙
 *
 * PENDING → APPROVED | REJECTED | CANCELLED
 * APPROVED → DRIVER_ACCEPTED | DRIVER_REJECTED | CANCELLED
 * DRIVER_ACCEPTED → DEPARTED | CANCELLED
 * DRIVER_REJECTED → APPROVED (다른 드라이버 재배정) | CANCELLED
 * DEPARTED → ARRIVED
 * ARRIVED → COMPLETED
 * REJECTED → (종료)
 * COMPLETED → (종료)
 * CANCELLED → (종료)
 */

const TRANSITION_MAP: Record<DispatchStatus, DispatchStatus[]> = {
  [DispatchStatus.PENDING]: [
    DispatchStatus.APPROVED,
    DispatchStatus.REJECTED,
    DispatchStatus.CANCELLED,
  ],
  [DispatchStatus.APPROVED]: [
    DispatchStatus.DRIVER_ACCEPTED,
    DispatchStatus.DRIVER_REJECTED,
    DispatchStatus.CANCELLED,
  ],
  [DispatchStatus.REJECTED]: [],
  [DispatchStatus.DRIVER_ACCEPTED]: [
    DispatchStatus.DEPARTED,
    DispatchStatus.CANCELLED,
  ],
  [DispatchStatus.DRIVER_REJECTED]: [
    DispatchStatus.APPROVED,
    DispatchStatus.CANCELLED,
  ],
  [DispatchStatus.DEPARTED]: [DispatchStatus.ARRIVED],
  [DispatchStatus.ARRIVED]: [DispatchStatus.COMPLETED],
  [DispatchStatus.COMPLETED]: [],
  [DispatchStatus.CANCELLED]: [],
};

export function canTransition(from: DispatchStatus, to: DispatchStatus): boolean {
  return TRANSITION_MAP[from]?.includes(to) ?? false;
}

export function assertTransition(from: DispatchStatus, to: DispatchStatus): void {
  if (!canTransition(from, to)) {
    throw new BusinessException(
      'CAR-E5001',
      `Invalid status transition: ${from} → ${to}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
