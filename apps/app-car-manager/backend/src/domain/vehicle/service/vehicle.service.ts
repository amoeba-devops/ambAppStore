import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { HttpStatus } from '@nestjs/common';
import { VehicleEntity } from '../entity/vehicle.entity';
import { VehicleManagerEntity } from '../entity/vehicle-manager.entity';
import {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  UpdateVehicleStatusRequest,
  UpdateDedicatedRequest,
} from '../dto/request/vehicle.request';
import { VehicleStatus } from '../../../common/constants/enums';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
    @InjectRepository(VehicleManagerEntity)
    private readonly managerRepo: Repository<VehicleManagerEntity>,
  ) {}

  async findAll(entityId: string, filters?: { type?: string; status?: string }): Promise<VehicleEntity[]> {
    const qb = this.vehicleRepo.createQueryBuilder('v')
      .where('v.entId = :entityId', { entityId })
      .andWhere('v.cvhDeletedAt IS NULL');

    if (filters?.type) {
      qb.andWhere('v.cvhType = :type', { type: filters.type });
    }
    if (filters?.status) {
      qb.andWhere('v.cvhStatus = :status', { status: filters.status });
    }

    qb.orderBy('v.cvhCreatedAt', 'DESC');
    return qb.getMany();
  }

  async findById(entityId: string, id: string): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { cvhId: id, entId: entityId, cvhDeletedAt: IsNull() },
      relations: ['managers', 'drivers'],
    });
    if (!vehicle) {
      throw new BusinessException('CAR-E3001', 'Vehicle not found', HttpStatus.NOT_FOUND);
    }
    return vehicle;
  }

  async create(entityId: string, req: CreateVehicleRequest): Promise<VehicleEntity> {
    // BR-015: 차량번호 법인 내 유니크
    const exists = await this.vehicleRepo.findOne({
      where: { entId: entityId, cvhPlateNumber: req.plate_number, cvhDeletedAt: IsNull() },
    });
    if (exists) {
      throw new BusinessException('CAR-E3002', 'Duplicate plate number within entity', HttpStatus.CONFLICT);
    }

    const vehicle = this.vehicleRepo.create({
      entId: entityId,
      cvhAmaAssetId: req.ama_asset_id || null,
      cvhPlateNumber: req.plate_number,
      cvhType: req.type,
      cvhMake: req.make,
      cvhModel: req.model,
      cvhYear: req.year,
      cvhColor: req.color || null,
      cvhVin: req.vin || null,
      cvhDisplacement: req.displacement || null,
      cvhFuelType: req.fuel_type,
      cvhTransmission: req.transmission || null,
      cvhMaxPassengers: req.max_passengers,
      cvhMaxLoadTon: req.max_load_ton || null,
      cvhCargoType: req.cargo_type || null,
      cvhPurchaseType: req.purchase_type || null,
      cvhPurchaseDate: req.purchase_date ? new Date(req.purchase_date) : null,
      cvhPurchasePrice: req.purchase_price || null,
      cvhNote: req.note || null,
    });

    return this.vehicleRepo.save(vehicle);
  }

  async update(entityId: string, id: string, req: UpdateVehicleRequest): Promise<VehicleEntity> {
    const vehicle = await this.findById(entityId, id);

    if (req.color !== undefined) vehicle.cvhColor = req.color || null;
    if (req.displacement !== undefined) vehicle.cvhDisplacement = req.displacement || null;
    if (req.transmission !== undefined) vehicle.cvhTransmission = req.transmission || null;
    if (req.max_passengers !== undefined) vehicle.cvhMaxPassengers = req.max_passengers;
    if (req.max_load_ton !== undefined) vehicle.cvhMaxLoadTon = req.max_load_ton || null;
    if (req.cargo_type !== undefined) vehicle.cvhCargoType = req.cargo_type || null;
    if (req.purchase_type !== undefined) vehicle.cvhPurchaseType = req.purchase_type || null;
    if (req.insurance_expiry !== undefined) vehicle.cvhInsuranceExpiry = req.insurance_expiry ? new Date(req.insurance_expiry) : null;
    if (req.inspection_date !== undefined) vehicle.cvhInspectionDate = req.inspection_date ? new Date(req.inspection_date) : null;
    if (req.note !== undefined) vehicle.cvhNote = req.note || null;

    return this.vehicleRepo.save(vehicle);
  }

  async updateStatus(entityId: string, id: string, req: UpdateVehicleStatusRequest): Promise<VehicleEntity> {
    const vehicle = await this.findById(entityId, id);
    // BR-008: 상태 변경 시 사유 필수 (DTO validation에서 처리)
    vehicle.cvhStatus = req.status as VehicleStatus;
    vehicle.cvhStatusReason = req.reason;
    return this.vehicleRepo.save(vehicle);
  }

  async updateDedicated(entityId: string, id: string, req: UpdateDedicatedRequest): Promise<VehicleEntity> {
    const vehicle = await this.findById(entityId, id);
    vehicle.cvhIsDedicated = req.is_dedicated;
    vehicle.cvhDedicatedDept = req.department || null;
    vehicle.cvhDedicatedStart = req.start_date ? new Date(req.start_date) : null;
    vehicle.cvhDedicatedEnd = req.end_date ? new Date(req.end_date) : null;
    return this.vehicleRepo.save(vehicle);
  }
}
