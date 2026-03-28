import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { MaintenanceRecordEntity } from '../entity/maintenance-record.entity';
import { CreateMaintenanceRequest, UpdateMaintenanceRequest } from '../dto/request/maintenance.request';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRecordEntity)
    private readonly maintenanceRepo: Repository<MaintenanceRecordEntity>,
  ) {}

  async findAll(entityId: string, filters?: { vehicleId?: string; type?: string }): Promise<MaintenanceRecordEntity[]> {
    const qb = this.maintenanceRepo.createQueryBuilder('m')
      .leftJoinAndSelect('m.vehicle', 'v')
      .where('m.entId = :entityId', { entityId })
      .andWhere('m.cmrDeletedAt IS NULL');

    if (filters?.vehicleId) {
      qb.andWhere('m.cvhId = :vehicleId', { vehicleId: filters.vehicleId });
    }
    if (filters?.type) {
      qb.andWhere('m.cmrType = :type', { type: filters.type });
    }

    qb.orderBy('m.cmrDate', 'DESC');
    return qb.getMany();
  }

  async findById(entityId: string, id: string): Promise<MaintenanceRecordEntity> {
    const record = await this.maintenanceRepo.findOne({
      where: { cmrId: id, entId: entityId, cmrDeletedAt: IsNull() },
      relations: ['vehicle'],
    });
    if (!record) {
      throw new BusinessException('CAR-E7001', 'Maintenance record not found', HttpStatus.NOT_FOUND);
    }
    return record;
  }

  async create(entityId: string, userId: string, req: CreateMaintenanceRequest): Promise<MaintenanceRecordEntity> {
    const record = this.maintenanceRepo.create({
      entId: entityId,
      cvhId: req.vehicle_id,
      cmrType: req.type,
      cmrDescription: req.description || null,
      cmrShopName: req.shop_name || null,
      cmrCost: req.cost ?? null,
      cmrDate: new Date(req.date),
      cmrNextDate: req.next_date ? new Date(req.next_date) : null,
      cmrPerformedBy: userId,
    });
    return this.maintenanceRepo.save(record);
  }

  async update(entityId: string, id: string, req: UpdateMaintenanceRequest): Promise<MaintenanceRecordEntity> {
    const record = await this.findById(entityId, id);

    if (req.type !== undefined) record.cmrType = req.type;
    if (req.description !== undefined) record.cmrDescription = req.description || null;
    if (req.shop_name !== undefined) record.cmrShopName = req.shop_name || null;
    if (req.cost !== undefined) record.cmrCost = req.cost ?? null;
    if (req.date !== undefined) record.cmrDate = new Date(req.date);
    if (req.next_date !== undefined) record.cmrNextDate = req.next_date ? new Date(req.next_date) : null;

    return this.maintenanceRepo.save(record);
  }

  async softDelete(entityId: string, id: string): Promise<void> {
    const record = await this.findById(entityId, id);
    await this.maintenanceRepo.softRemove(record);
  }
}
