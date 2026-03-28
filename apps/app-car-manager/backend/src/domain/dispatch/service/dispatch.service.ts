import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { DispatchRequestEntity } from '../entity/dispatch-request.entity';
import { VehicleEntity } from '../../vehicle/entity/vehicle.entity';
import {
  CreateDispatchRequest,
  ApproveDispatchRequest,
  RejectDispatchRequest,
  DriverRespondRequest,
  CancelDispatchRequest,
} from '../dto/request/dispatch.request';
import { DispatchStatus, VehicleStatus } from '../../../common/constants/enums';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { assertTransition } from '../engine/dispatch-state-machine';

@Injectable()
export class DispatchService {
  constructor(
    @InjectRepository(DispatchRequestEntity)
    private readonly dispatchRepo: Repository<DispatchRequestEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
  ) {}

  async findAll(
    entityId: string,
    filters?: { status?: string; vehicleId?: string; driverId?: string },
  ): Promise<DispatchRequestEntity[]> {
    const qb = this.dispatchRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.vehicle', 'v')
      .leftJoinAndSelect('d.driver', 'dr')
      .where('d.entId = :entityId', { entityId })
      .andWhere('d.cdrDeletedAt IS NULL');

    if (filters?.status) {
      qb.andWhere('d.cdrStatus = :status', { status: filters.status });
    }
    if (filters?.vehicleId) {
      qb.andWhere('d.cvhId = :vehicleId', { vehicleId: filters.vehicleId });
    }
    if (filters?.driverId) {
      qb.andWhere('d.cvdId = :driverId', { driverId: filters.driverId });
    }

    qb.orderBy('d.cdrDepartAt', 'DESC');
    return qb.getMany();
  }

  async findById(entityId: string, id: string): Promise<DispatchRequestEntity> {
    const dispatch = await this.dispatchRepo.findOne({
      where: { cdrId: id, entId: entityId, cdrDeletedAt: IsNull() },
      relations: ['vehicle', 'driver', 'tripLog'],
    });
    if (!dispatch) {
      throw new BusinessException('CAR-E5002', 'Dispatch request not found', HttpStatus.NOT_FOUND);
    }
    return dispatch;
  }

  async create(
    entityId: string,
    userId: string,
    userName: string,
    req: CreateDispatchRequest,
  ): Promise<DispatchRequestEntity> {
    const dispatch = this.dispatchRepo.create({
      entId: entityId,
      cdrRequesterId: userId,
      cdrRequesterName: userName,
      cdrPurposeType: req.purpose_type,
      cdrPurpose: req.purpose,
      cdrDepartAt: new Date(req.depart_at),
      cdrReturnAt: new Date(req.return_at),
      cdrOrigin: req.origin,
      cdrDestination: req.destination,
      cdrPassengerCount: req.passenger_count || 1,
      cdrPassengerList: req.passenger_list || null,
      cdrPreferredVehicleType: req.preferred_vehicle_type || null,
      cdrCargoInfo: req.cargo_info || null,
      cdrIsProxy: req.is_proxy || false,
      cdrActualUserName: req.actual_user_name || null,
      cdrNote: req.note || null,
    });

    return this.dispatchRepo.save(dispatch);
  }

  async approve(entityId: string, id: string, req: ApproveDispatchRequest): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);
    assertTransition(dispatch.cdrStatus, DispatchStatus.APPROVED);

    // BR-005: 차량 배정 시 가용 상태 확인
    const vehicle = await this.vehicleRepo.findOne({
      where: { cvhId: req.vehicle_id, entId: entityId, cvhDeletedAt: IsNull() },
    });
    if (!vehicle) {
      throw new BusinessException('CAR-E5003', 'Vehicle not found', HttpStatus.NOT_FOUND);
    }
    if (vehicle.cvhStatus !== VehicleStatus.AVAILABLE) {
      throw new BusinessException('CAR-E5004', 'Vehicle is not available', HttpStatus.BAD_REQUEST);
    }

    // BR-006: 시간 겹침 체크
    const overlap = await this.checkTimeOverlap(req.vehicle_id, dispatch.cdrDepartAt, dispatch.cdrReturnAt, id);
    if (overlap) {
      throw new BusinessException('CAR-E5005', 'Vehicle time conflict with another dispatch', HttpStatus.CONFLICT);
    }

    dispatch.cvhId = req.vehicle_id;
    dispatch.cvdId = req.driver_id || null;
    dispatch.cdrStatus = DispatchStatus.APPROVED;
    dispatch.cdrApprovedAt = new Date();
    dispatch.cdrRejectReason = null;

    // 드라이버 없으면 DRIVER_OVERRIDE = true (드라이버 확인 생략)
    if (!req.driver_id) {
      dispatch.cdrDriverOverride = true;
    }

    return this.dispatchRepo.save(dispatch);
  }

  async reject(entityId: string, id: string, req: RejectDispatchRequest): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);
    assertTransition(dispatch.cdrStatus, DispatchStatus.REJECTED);

    dispatch.cdrStatus = DispatchStatus.REJECTED;
    dispatch.cdrRejectReason = req.reason;
    return this.dispatchRepo.save(dispatch);
  }

  async driverRespond(entityId: string, id: string, req: DriverRespondRequest): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);

    if (req.accepted) {
      assertTransition(dispatch.cdrStatus, DispatchStatus.DRIVER_ACCEPTED);
      dispatch.cdrStatus = DispatchStatus.DRIVER_ACCEPTED;
      dispatch.cdrDriverAcceptedAt = new Date();
    } else {
      assertTransition(dispatch.cdrStatus, DispatchStatus.DRIVER_REJECTED);
      dispatch.cdrStatus = DispatchStatus.DRIVER_REJECTED;
      dispatch.cdrDriverRejectReason = req.reject_reason || null;
    }

    return this.dispatchRepo.save(dispatch);
  }

  async depart(entityId: string, id: string): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);
    // DRIVER_OVERRIDE 시 APPROVED에서도 DEPARTED 가능
    if (dispatch.cdrDriverOverride && dispatch.cdrStatus === DispatchStatus.APPROVED) {
      dispatch.cdrStatus = DispatchStatus.DEPARTED;
    } else {
      assertTransition(dispatch.cdrStatus, DispatchStatus.DEPARTED);
      dispatch.cdrStatus = DispatchStatus.DEPARTED;
    }
    dispatch.cdrDepartedAt = new Date();

    // 차량 상태 IN_USE로 변경
    if (dispatch.cvhId) {
      await this.vehicleRepo.update(dispatch.cvhId, { cvhStatus: VehicleStatus.IN_USE });
    }

    return this.dispatchRepo.save(dispatch);
  }

  async arrive(entityId: string, id: string): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);
    assertTransition(dispatch.cdrStatus, DispatchStatus.ARRIVED);

    dispatch.cdrStatus = DispatchStatus.ARRIVED;
    dispatch.cdrArrivedAt = new Date();
    return this.dispatchRepo.save(dispatch);
  }

  async complete(entityId: string, id: string): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);
    assertTransition(dispatch.cdrStatus, DispatchStatus.COMPLETED);

    dispatch.cdrStatus = DispatchStatus.COMPLETED;
    dispatch.cdrCompletedAt = new Date();

    // 차량 상태 복원
    if (dispatch.cvhId) {
      await this.vehicleRepo.update(dispatch.cvhId, { cvhStatus: VehicleStatus.AVAILABLE });
    }

    return this.dispatchRepo.save(dispatch);
  }

  async cancel(entityId: string, id: string, req: CancelDispatchRequest): Promise<DispatchRequestEntity> {
    const dispatch = await this.findById(entityId, id);
    assertTransition(dispatch.cdrStatus, DispatchStatus.CANCELLED);

    dispatch.cdrStatus = DispatchStatus.CANCELLED;
    dispatch.cdrCancelReason = req.reason;

    // 출발 후 취소면 차량 상태 복원
    if (dispatch.cvhId && dispatch.cdrDepartedAt) {
      await this.vehicleRepo.update(dispatch.cvhId, { cvhStatus: VehicleStatus.AVAILABLE });
    }

    return this.dispatchRepo.save(dispatch);
  }

  private async checkTimeOverlap(
    vehicleId: string,
    departAt: Date,
    returnAt: Date,
    excludeId?: string,
  ): Promise<boolean> {
    const qb = this.dispatchRepo.createQueryBuilder('d')
      .where('d.cvhId = :vehicleId', { vehicleId })
      .andWhere('d.cdrDeletedAt IS NULL')
      .andWhere('d.cdrStatus NOT IN (:...excludeStatuses)', {
        excludeStatuses: [DispatchStatus.REJECTED, DispatchStatus.CANCELLED, DispatchStatus.COMPLETED],
      })
      .andWhere('d.cdrDepartAt < :returnAt', { returnAt })
      .andWhere('d.cdrReturnAt > :departAt', { departAt });

    if (excludeId) {
      qb.andWhere('d.cdrId != :excludeId', { excludeId });
    }

    const count = await qb.getCount();
    return count > 0;
  }
}
