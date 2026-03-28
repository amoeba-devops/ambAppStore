import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleEntity } from '../../vehicle/entity/vehicle.entity';
import { VehicleDriverEntity } from '../../driver/entity/vehicle-driver.entity';
import { DispatchRequestEntity } from '../../dispatch/entity/dispatch-request.entity';
import { VehicleStatus, DriverStatus, DispatchStatus } from '../../../common/constants/enums';
import { DashboardSummaryResponse, ActiveDispatchResponse } from '../dto/response/monitor.response';

@Injectable()
export class MonitorService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
    @InjectRepository(VehicleDriverEntity)
    private readonly driverRepo: Repository<VehicleDriverEntity>,
    @InjectRepository(DispatchRequestEntity)
    private readonly dispatchRepo: Repository<DispatchRequestEntity>,
  ) {}

  async getDashboardSummary(entityId: string): Promise<DashboardSummaryResponse> {
    // 차량 통계
    const vehicleStats = await this.vehicleRepo
      .createQueryBuilder('v')
      .select('v.cvhStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('v.entId = :entityId', { entityId })
      .andWhere('v.cvhDeletedAt IS NULL')
      .groupBy('v.cvhStatus')
      .getRawMany();

    const vMap = new Map(vehicleStats.map((r) => [r.status, Number(r.count)]));

    // 운전자 통계
    const driverStats = await this.driverRepo
      .createQueryBuilder('d')
      .select('d.cvdStatus', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('d.entId = :entityId', { entityId })
      .andWhere('d.cvdDeletedAt IS NULL')
      .groupBy('d.cvdStatus')
      .getRawMany();

    const dMap = new Map(driverStats.map((r) => [r.status, Number(r.count)]));

    // 배차 통계
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dispatchPending = await this.dispatchRepo.count({
      where: { entId: entityId, cdrStatus: DispatchStatus.PENDING, cdrDeletedAt: null as any },
    });
    const dispatchApproved = await this.dispatchRepo.count({
      where: { entId: entityId, cdrStatus: DispatchStatus.APPROVED, cdrDeletedAt: null as any },
    });
    const dispatchInProgress = await this.dispatchRepo
      .createQueryBuilder('d')
      .where('d.entId = :entityId', { entityId })
      .andWhere('d.cdrDeletedAt IS NULL')
      .andWhere('d.cdrStatus IN (:...statuses)', {
        statuses: [DispatchStatus.DEPARTED, DispatchStatus.ARRIVED],
      })
      .getCount();

    const completedToday = await this.dispatchRepo
      .createQueryBuilder('d')
      .where('d.entId = :entityId', { entityId })
      .andWhere('d.cdrStatus = :status', { status: DispatchStatus.COMPLETED })
      .andWhere('d.cdrCompletedAt >= :today', { today })
      .andWhere('d.cdrCompletedAt < :tomorrow', { tomorrow })
      .getCount();

    return {
      vehicles: {
        total: Array.from(vMap.values()).reduce((a, b) => a + b, 0),
        available: vMap.get(VehicleStatus.AVAILABLE) || 0,
        inUse: vMap.get(VehicleStatus.IN_USE) || 0,
        maintenance: vMap.get(VehicleStatus.MAINTENANCE) || 0,
        unavailable: vMap.get(VehicleStatus.DISPOSED) || 0,
      },
      drivers: {
        total: Array.from(dMap.values()).reduce((a, b) => a + b, 0),
        active: dMap.get(DriverStatus.ACTIVE) || 0,
        onLeave: dMap.get(DriverStatus.ON_LEAVE) || 0,
        inactive: dMap.get(DriverStatus.INACTIVE) || 0,
      },
      dispatches: {
        pending: dispatchPending,
        approved: dispatchApproved,
        inProgress: dispatchInProgress,
        completedToday,
      },
    };
  }

  async getActiveDispatches(entityId: string): Promise<ActiveDispatchResponse[]> {
    const dispatches = await this.dispatchRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.vehicle', 'v')
      .leftJoinAndSelect('d.driver', 'dr')
      .where('d.entId = :entityId', { entityId })
      .andWhere('d.cdrDeletedAt IS NULL')
      .andWhere('d.cdrStatus IN (:...statuses)', {
        statuses: [
          DispatchStatus.APPROVED,
          DispatchStatus.DRIVER_ACCEPTED,
          DispatchStatus.DEPARTED,
          DispatchStatus.ARRIVED,
        ],
      })
      .orderBy('d.cdrDepartAt', 'ASC')
      .getMany();

    return dispatches.map((d) => ({
      dispatchId: d.cdrId,
      vehiclePlateNumber: d.vehicle?.cvhPlateNumber || '',
      vehicleModel: d.vehicle ? `${d.vehicle.cvhMake} ${d.vehicle.cvhModel}` : '',
      driverName: null, // AMA user name은 별도 조회 필요
      origin: d.cdrOrigin,
      destination: d.cdrDestination,
      status: d.cdrStatus,
      departAt: d.cdrDepartAt?.toISOString(),
      returnAt: d.cdrReturnAt?.toISOString(),
    }));
  }
}
