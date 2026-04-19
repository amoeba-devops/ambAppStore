import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TripLogEntity } from '../entity/trip-log.entity';
import { DispatchRequestEntity } from '../../dispatch/entity/dispatch-request.entity';
import { CreateTripLogRequest } from '../dto/request/create-trip-log.request';
import { UpdateTripLogRequest, SubmitTripLogRequest } from '../dto/request/trip-log.request';
import { TripLogStatus, DispatchStatus, DispatchPurposeType } from '../../../common/constants/enums';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class TripLogService {
  constructor(
    @InjectRepository(TripLogEntity)
    private readonly tripLogRepo: Repository<TripLogEntity>,
    @InjectRepository(DispatchRequestEntity)
    private readonly dispatchRepo: Repository<DispatchRequestEntity>,
  ) {}

  async findAll(entityId: string, filters?: { vehicleId?: string; status?: string }): Promise<TripLogEntity[]> {
    const qb = this.tripLogRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.vehicle', 'v')
      .leftJoinAndSelect('t.driver', 'd')
      .leftJoinAndSelect('t.dispatchRequest', 'dr')
      .where('t.entId = :entityId', { entityId })
      .andWhere('t.ctlDeletedAt IS NULL');

    if (filters?.vehicleId) {
      qb.andWhere('t.cvhId = :vehicleId', { vehicleId: filters.vehicleId });
    }
    if (filters?.status) {
      qb.andWhere('t.ctlStatus = :status', { status: filters.status });
    }

    qb.orderBy('t.ctlCreatedAt', 'DESC');
    return qb.getMany();
  }

  async findById(entityId: string, id: string): Promise<TripLogEntity> {
    const tripLog = await this.tripLogRepo.findOne({
      where: { ctlId: id, entId: entityId, ctlDeletedAt: IsNull() },
      relations: ['vehicle', 'driver', 'dispatchRequest'],
    });
    if (!tripLog) {
      throw new BusinessException('CAR-E6001', 'Trip log not found', HttpStatus.NOT_FOUND);
    }
    return tripLog;
  }

  async create(
    entityId: string,
    userId: string,
    userName: string,
    req: CreateTripLogRequest,
  ): Promise<TripLogEntity> {
    // Proxy dispatch 생성 (수동 등록용)
    const dispatch = this.dispatchRepo.create({
      entId: entityId,
      cvhId: req.vehicle_id,
      cvdId: req.driver_id,
      cdrRequesterId: userId,
      cdrRequesterName: userName,
      cdrPurposeType: DispatchPurposeType.BUSINESS,
      cdrPurpose: 'Manual trip log entry',
      cdrDepartAt: req.depart_actual ? new Date(req.depart_actual) : new Date(),
      cdrReturnAt: req.arrive_actual ? new Date(req.arrive_actual) : new Date(),
      cdrOrigin: req.origin,
      cdrDestination: req.destination,
      cdrPassengerCount: 1,
      cdrStatus: DispatchStatus.COMPLETED,
      cdrIsProxy: true,
      cdrNote: 'MANUAL_ENTRY',
      cdrApprovedAt: new Date(),
      cdrCompletedAt: req.arrive_actual ? new Date(req.arrive_actual) : null,
      cdrDriverOverride: true,
    });
    const savedDispatch = await this.dispatchRepo.save(dispatch);

    // 거리 자동 계산
    let distanceKm: number | null = null;
    if (req.odo_start != null && req.odo_end != null) {
      distanceKm = req.odo_end - req.odo_start;
    }

    const tripLog = this.tripLogRepo.create({
      entId: entityId,
      cvhId: req.vehicle_id,
      cvdId: req.driver_id,
      cdrId: savedDispatch.cdrId,
      ctlOrigin: req.origin,
      ctlDestination: req.destination,
      ctlCustomerName: req.customer_name || null,
      ctlBillNo: req.bill_no || null,
      ctlCdfNo: req.cdf_no || null,
      ctlDepartActual: req.depart_actual ? new Date(req.depart_actual) : null,
      ctlArriveActual: req.arrive_actual ? new Date(req.arrive_actual) : null,
      ctlOdoStart: req.odo_start ?? null,
      ctlOdoEnd: req.odo_end ?? null,
      ctlDistanceKm: distanceKm,
      ctlRefueled: req.refueled ?? false,
      ctlFuelAmount: req.fuel_amount ?? null,
      ctlFuelCost: req.fuel_cost ?? null,
      ctlTollCost: req.toll_cost ?? null,
      ctlHasAccident: req.has_accident ?? false,
      ctlNote: req.note || null,
      ctlKrPurposeCode: req.kr_purpose_code ?? null,
      ctlKrBusinessRatio: req.kr_business_ratio ?? null,
    });

    return this.tripLogRepo.save(tripLog);
  }

  async createFromDispatch(
    entityId: string,
    dispatchId: string,
    vehicleId: string,
    driverId: string,
    origin: string,
    destination: string,
  ): Promise<TripLogEntity> {
    const tripLog = this.tripLogRepo.create({
      entId: entityId,
      cdrId: dispatchId,
      cvhId: vehicleId,
      cvdId: driverId || null,
      ctlOrigin: origin,
      ctlDestination: destination,
      ctlDepartActual: new Date(),
    });
    return this.tripLogRepo.save(tripLog);
  }

  async completeByDispatch(entityId: string, dispatchId: string): Promise<void> {
    const tripLog = await this.tripLogRepo.findOne({
      where: { entId: entityId, cdrId: dispatchId, ctlDeletedAt: IsNull() },
    });
    if (tripLog && tripLog.ctlStatus === TripLogStatus.IN_PROGRESS) {
      tripLog.ctlStatus = TripLogStatus.COMPLETED;
      tripLog.ctlArriveActual = new Date();
      tripLog.ctlSubmittedAt = new Date();
      await this.tripLogRepo.save(tripLog);
    }
  }

  async update(entityId: string, id: string, req: UpdateTripLogRequest): Promise<TripLogEntity> {
    const tripLog = await this.findById(entityId, id);

    if (tripLog.ctlStatus === TripLogStatus.VERIFIED) {
      throw new BusinessException('CAR-E6002', 'Cannot update verified trip log', HttpStatus.BAD_REQUEST);
    }

    if (req.driver_id !== undefined) tripLog.cvdId = req.driver_id;
    if (req.depart_actual !== undefined) tripLog.ctlDepartActual = req.depart_actual ? new Date(req.depart_actual) : null;
    if (req.arrive_actual !== undefined) tripLog.ctlArriveActual = req.arrive_actual ? new Date(req.arrive_actual) : null;
    if (req.odo_start !== undefined) tripLog.ctlOdoStart = req.odo_start ?? null;
    if (req.odo_end !== undefined) tripLog.ctlOdoEnd = req.odo_end ?? null;
    if (req.distance_km !== undefined) tripLog.ctlDistanceKm = req.distance_km ?? null;
    if (req.refueled !== undefined) tripLog.ctlRefueled = req.refueled;
    if (req.fuel_amount !== undefined) tripLog.ctlFuelAmount = req.fuel_amount ?? null;
    if (req.fuel_cost !== undefined) tripLog.ctlFuelCost = req.fuel_cost ?? null;
    if (req.toll_cost !== undefined) tripLog.ctlTollCost = req.toll_cost ?? null;
    if (req.has_accident !== undefined) tripLog.ctlHasAccident = req.has_accident;
    if (req.note !== undefined) tripLog.ctlNote = req.note || null;
    if (req.kr_purpose_code !== undefined) tripLog.ctlKrPurposeCode = req.kr_purpose_code ?? null;
    if (req.kr_business_ratio !== undefined) tripLog.ctlKrBusinessRatio = req.kr_business_ratio ?? null;

    // 자동 거리 계산
    if (tripLog.ctlOdoStart != null && tripLog.ctlOdoEnd != null) {
      tripLog.ctlDistanceKm = tripLog.ctlOdoEnd - tripLog.ctlOdoStart;
    }

    const saved = await this.tripLogRepo.save(tripLog);

    // 탑승인원 업데이트 (dispatch)
    if (req.passenger_count !== undefined && tripLog.cdrId) {
      await this.dispatchRepo.update(tripLog.cdrId, {
        cdrPassengerCount: req.passenger_count,
      });
    }

    return saved;
  }

  async submit(entityId: string, id: string, req: SubmitTripLogRequest): Promise<TripLogEntity> {
    const tripLog = await this.findById(entityId, id);

    if (req.status === TripLogStatus.COMPLETED && tripLog.ctlStatus !== TripLogStatus.IN_PROGRESS) {
      throw new BusinessException('CAR-E6003', 'Can only submit in-progress trip logs', HttpStatus.BAD_REQUEST);
    }
    if (req.status === TripLogStatus.VERIFIED && tripLog.ctlStatus !== TripLogStatus.COMPLETED) {
      throw new BusinessException('CAR-E6004', 'Can only verify completed trip logs', HttpStatus.BAD_REQUEST);
    }

    tripLog.ctlStatus = req.status;
    if (req.status === TripLogStatus.COMPLETED) {
      tripLog.ctlSubmittedAt = new Date();
    }

    return this.tripLogRepo.save(tripLog);
  }
}
