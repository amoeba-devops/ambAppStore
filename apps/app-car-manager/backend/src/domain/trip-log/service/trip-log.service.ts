import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TripLogEntity } from '../entity/trip-log.entity';
import { UpdateTripLogRequest, SubmitTripLogRequest } from '../dto/request/trip-log.request';
import { TripLogStatus } from '../../../common/constants/enums';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class TripLogService {
  constructor(
    @InjectRepository(TripLogEntity)
    private readonly tripLogRepo: Repository<TripLogEntity>,
  ) {}

  async findAll(entityId: string, filters?: { vehicleId?: string; status?: string }): Promise<TripLogEntity[]> {
    const qb = this.tripLogRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.vehicle', 'v')
      .leftJoinAndSelect('t.driver', 'd')
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
      cvdId: driverId,
      ctlOrigin: origin,
      ctlDestination: destination,
      ctlDepartActual: new Date(),
    });
    return this.tripLogRepo.save(tripLog);
  }

  async update(entityId: string, id: string, req: UpdateTripLogRequest): Promise<TripLogEntity> {
    const tripLog = await this.findById(entityId, id);

    if (tripLog.ctlStatus === TripLogStatus.VERIFIED) {
      throw new BusinessException('CAR-E6002', 'Cannot update verified trip log', HttpStatus.BAD_REQUEST);
    }

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

    return this.tripLogRepo.save(tripLog);
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
