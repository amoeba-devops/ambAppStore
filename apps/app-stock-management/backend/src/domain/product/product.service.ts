import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Product } from './entity/product.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId, prdDeletedAt: IsNull() }, order: { prdCreatedAt: 'DESC' } });
  }

  async findById(id: string, entId: string) {
    const product = await this.repo.findOne({ where: { prdId: id, entId, prdDeletedAt: IsNull() } });
    if (!product) throw new BusinessException('ASM-E2100', 'Product not found', HttpStatus.NOT_FOUND);
    return product;
  }

  async create(entId: string, data: Record<string, any>) {
    if (!data.prd_code || !data.prd_name) {
      throw new BusinessException('ASM-E2101', 'prd_code and prd_name are required', HttpStatus.BAD_REQUEST);
    }
    const existing = await this.repo.findOne({ where: { entId, prdCode: data.prd_code, prdDeletedAt: IsNull() } });
    if (existing) throw new BusinessException('ASM-E2102', 'Product code already exists', HttpStatus.CONFLICT);
    const entity = this.repo.create({
      entId,
      prdCode: data.prd_code,
      prdName: data.prd_name,
      prdCategory: data.prd_category ?? null,
      prdBrand: data.prd_brand ?? null,
      prdDescription: data.prd_description ?? null,
      prdNote: data.prd_note ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, entId: string, data: Record<string, any>) {
    const product = await this.findById(id, entId);
    if (data.prd_code !== undefined) product.prdCode = data.prd_code;
    if (data.prd_name !== undefined) product.prdName = data.prd_name;
    if (data.prd_category !== undefined) product.prdCategory = data.prd_category;
    if (data.prd_brand !== undefined) product.prdBrand = data.prd_brand;
    if (data.prd_description !== undefined) product.prdDescription = data.prd_description;
    if (data.prd_note !== undefined) product.prdNote = data.prd_note;
    return this.repo.save(product);
  }

  async softDelete(id: string, entId: string) {
    const product = await this.findById(id, entId);
    product.prdDeletedAt = new Date();
    return this.repo.save(product);
  }
}
