import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { VehicleDriverEntity } from '../entity/vehicle-driver.entity';
import {
  CreateDriverRequest,
  UpdateDriverRequest,
  UpdateDriverStatusRequest,
  AssignDriverRequest,
} from '../dto/request/driver.request';
import { DriverStatus } from '../../../common/constants/enums';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { AmaService } from '../../ama/service/ama.service';

@Injectable()
export class DriverService {
  private readonly logger = new Logger(DriverService.name);

  constructor(
    @InjectRepository(VehicleDriverEntity)
    private readonly driverRepo: Repository<VehicleDriverEntity>,
    private readonly amaService: AmaService,
  ) {}

  async findAll(entityId: string, filters?: { vehicleId?: string; status?: string }): Promise<VehicleDriverEntity[]> {
    const qb = this.driverRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.vehicle', 'v')
      .where('d.entId = :entityId', { entityId })
      .andWhere('d.cvdDeletedAt IS NULL');

    if (filters?.vehicleId) {
      qb.andWhere('d.cvhId = :vehicleId', { vehicleId: filters.vehicleId });
    }
    if (filters?.status) {
      qb.andWhere('d.cvdStatus = :status', { status: filters.status });
    }

    qb.orderBy('d.cvdCreatedAt', 'DESC');
    const drivers = await qb.getMany();

    return drivers;
  }

  /**
   * Controller에서 호출: AMA 멤버로 이름 보정
   */
  async enrichDriverNames(amaJwt: string, entityId: string, drivers: VehicleDriverEntity[]): Promise<void> {
    const unnamed = drivers.filter((d) => !d.cvdDriverName);
    if (unnamed.length === 0) return;

    try {
      const members = await this.amaService.getMembers(amaJwt, entityId);
      if (members.length === 0) return;

      const memberMap = new Map(members.map((m) => [m.userId, m]));

      for (const driver of unnamed) {
        const member = memberMap.get(driver.cvdAmaUserId);
        if (member) {
          driver.cvdDriverName = member.name;
          driver.cvdDriverEmail = member.email;
          await this.driverRepo.save(driver);
        }
      }
    } catch {
      // AMA 조회 실패 시 무시 — 다음에 재시도
    }
  }

  async findById(entityId: string, id: string): Promise<VehicleDriverEntity> {
    const driver = await this.driverRepo.findOne({
      where: { cvdId: id, entId: entityId, cvdDeletedAt: IsNull() },
      relations: ['vehicle'],
    });
    if (!driver) {
      throw new BusinessException('CAR-E4001', 'Driver not found', HttpStatus.NOT_FOUND);
    }
    return driver;
  }

  async findAvailableDrivers(entityId: string): Promise<VehicleDriverEntity[]> {
    return this.driverRepo.find({
      where: { entId: entityId, cvdStatus: DriverStatus.ACTIVE, cvdDeletedAt: IsNull() },
      relations: ['vehicle'],
    });
  }

  async create(entityId: string, req: CreateDriverRequest): Promise<VehicleDriverEntity> {
    // BR-019: 같은 Entity 내 동일 ama_user_id 중복 등록 방지
    const exists = await this.driverRepo.findOne({
      where: { entId: entityId, cvdAmaUserId: req.ama_user_id, cvdDeletedAt: IsNull() },
    });
    if (exists) {
      throw new BusinessException('CAR-E4002', 'Driver already registered in this entity', HttpStatus.CONFLICT);
    }

    const driver = this.driverRepo.create({
      entId: entityId,
      cvhId: req.vehicle_id || null,
      cvdAmaUserId: req.ama_user_id,
      cvdDriverName: req.driver_name || null,
      cvdDriverEmail: req.driver_email || null,
      cvdRole: req.role,
      cvdNote: req.note || null,
    });

    return this.driverRepo.save(driver);
  }

  async update(entityId: string, id: string, req: UpdateDriverRequest): Promise<VehicleDriverEntity> {
    const driver = await this.findById(entityId, id);

    if (req.vehicle_id !== undefined) driver.cvhId = req.vehicle_id;
    if (req.role !== undefined) driver.cvdRole = req.role;
    if (req.note !== undefined) driver.cvdNote = req.note || null;

    return this.driverRepo.save(driver);
  }

  async updateStatus(entityId: string, id: string, req: UpdateDriverStatusRequest): Promise<VehicleDriverEntity> {
    const driver = await this.findById(entityId, id);
    driver.cvdStatus = req.status as DriverStatus;

    if (req.status === DriverStatus.ON_LEAVE) {
      driver.cvdLeaveStart = req.leave_start ? new Date(req.leave_start) : null;
      driver.cvdLeaveEnd = req.leave_end ? new Date(req.leave_end) : null;
    } else {
      driver.cvdLeaveStart = null;
      driver.cvdLeaveEnd = null;
    }

    return this.driverRepo.save(driver);
  }

  async assignVehicle(entityId: string, id: string, req: AssignDriverRequest): Promise<VehicleDriverEntity> {
    const driver = await this.findById(entityId, id);
    driver.cvhId = req.vehicle_id;
    return this.driverRepo.save(driver);
  }

  async unassignVehicle(entityId: string, id: string): Promise<VehicleDriverEntity> {
    const driver = await this.findById(entityId, id);
    driver.cvhId = null;
    return this.driverRepo.save(driver);
  }

  async softDelete(entityId: string, id: string): Promise<void> {
    const driver = await this.findById(entityId, id);
    await this.driverRepo.softRemove(driver);
  }
}
