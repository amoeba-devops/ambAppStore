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

  async create(entId: string, data: Partial<Product>) {
    const entity = this.repo.create({ ...data, entId });
    return this.repo.save(entity);
  }

  async update(id: string, entId: string, data: Partial<Product>) {
    const product = await this.findById(id, entId);
    Object.assign(product, data);
    return this.repo.save(product);
  }

  async softDelete(id: string, entId: string) {
    const product = await this.findById(id, entId);
    product.prdDeletedAt = new Date();
    return this.repo.save(product);
  }
}
