import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { SpuMasterEntity } from '../spu-master/entity/spu-master.entity';
import { SkuMasterEntity } from '../sku-master/entity/sku-master.entity';
import { UploadHistoryService } from '../upload-history/upload-history.service';
import { BusinessException } from '../../common/exceptions/business.exception';

const TEMPLATE_HEADERS = [
  { key: 'spu_code', header: 'SPU Code', width: 12 },
  { key: 'spu_name_kr', header: 'SPU Name (KR)', width: 20 },
  { key: 'spu_name_en', header: 'SPU Name (EN)', width: 20 },
  { key: 'spu_name_vi', header: 'SPU Name (VI)', width: 20 },
  { key: 'brand_code', header: 'Brand Code', width: 12 },
  { key: 'sub_brand', header: 'Sub Brand', width: 12 },
  { key: 'category_code', header: 'Category Code', width: 14 },
  { key: 'category_name', header: 'Category Name', width: 18 },
  { key: 'sku_wms_code', header: 'SKU WMS Code', width: 18 },
  { key: 'sku_name_kr', header: 'SKU Name (KR)', width: 20 },
  { key: 'sku_name_en', header: 'SKU Name (EN)', width: 20 },
  { key: 'sku_name_vi', header: 'SKU Name (VI)', width: 20 },
  { key: 'variant_type', header: 'Variant Type', width: 14 },
  { key: 'variant_value', header: 'Variant Value', width: 14 },
  { key: 'sync_code', header: 'Sync Code', width: 14 },
  { key: 'gtin_code', header: 'GTIN Code', width: 14 },
  { key: 'hs_code', header: 'HS Code', width: 14 },
  { key: 'weight_gram', header: 'Weight (g)', width: 12 },
  { key: 'prime_cost', header: 'Prime Cost', width: 14 },
  { key: 'supply_price', header: 'Supply Price', width: 14 },
  { key: 'listing_price', header: 'Listing Price', width: 14 },
  { key: 'selling_price', header: 'Selling Price', width: 14 },
  { key: 'fulfillment_fee', header: 'Fulfillment Fee', width: 14 },
];

@Injectable()
export class ProductMasterExcelService {
  constructor(
    @InjectRepository(SpuMasterEntity)
    private readonly spuRepo: Repository<SpuMasterEntity>,
    @InjectRepository(SkuMasterEntity)
    private readonly skuRepo: Repository<SkuMasterEntity>,
    private readonly dataSource: DataSource,
    private readonly uploadHistoryService: UploadHistoryService,
  ) {}

  async generateTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Product Master');

    ws.columns = TEMPLATE_HEADERS.map((h) => ({
      header: h.header,
      key: h.key,
      width: h.width,
    }));

    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    // Example row
    ws.addRow({
      spu_code: 'SB-AA01',
      spu_name_kr: '예시 상품',
      spu_name_en: 'Example Product',
      spu_name_vi: 'Sản phẩm ví dụ',
      brand_code: 'SB',
      sub_brand: '',
      category_code: 'SKC',
      category_name: 'Skincare',
      sku_wms_code: 'SB-AA01-01',
      sku_name_kr: '예시 변형 50ml',
      sku_name_en: 'Example Variant 50ml',
      sku_name_vi: 'Ví dụ biến thể 50ml',
      variant_type: 'SIZE',
      variant_value: '50ml',
      sync_code: '',
      gtin_code: '',
      hs_code: '',
      weight_gram: 150,
      prime_cost: 50000,
      supply_price: 80000,
      listing_price: 120000,
      selling_price: 99000,
      fulfillment_fee: 5000,
    });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportData(entId: string): Promise<Buffer> {
    const skus = await this.skuRepo
      .createQueryBuilder('sku')
      .leftJoinAndSelect('sku.spu', 'spu')
      .where('sku.entId = :entId', { entId })
      .andWhere('sku.skuDeletedAt IS NULL')
      .orderBy('sku.skuSpuCode', 'ASC')
      .addOrderBy('sku.skuWmsCode', 'ASC')
      .getMany();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Product Master');

    ws.columns = TEMPLATE_HEADERS.map((h) => ({
      header: h.header,
      key: h.key,
      width: h.width,
    }));

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    for (const sku of skus) {
      ws.addRow({
        spu_code: sku.skuSpuCode,
        spu_name_kr: sku.spu?.spuNameKr ?? '',
        spu_name_en: sku.spu?.spuNameEn ?? '',
        spu_name_vi: sku.spu?.spuNameVi ?? '',
        brand_code: sku.spu?.spuBrandCode ?? '',
        sub_brand: sku.spu?.spuSubBrand ?? '',
        category_code: sku.spu?.spuCategoryCode ?? '',
        category_name: sku.spu?.spuCategoryName ?? '',
        sku_wms_code: sku.skuWmsCode,
        sku_name_kr: sku.skuNameKr,
        sku_name_en: sku.skuNameEn,
        sku_name_vi: sku.skuNameVi,
        variant_type: sku.skuVariantType ?? '',
        variant_value: sku.skuVariantValue ?? '',
        sync_code: sku.skuSyncCode ?? '',
        gtin_code: sku.skuGtinCode ?? '',
        hs_code: sku.skuHsCode ?? '',
        weight_gram: sku.skuWeightGram ?? '',
        prime_cost: Number(sku.skuPrimeCost) || 0,
        supply_price: sku.skuSupplyPrice != null ? Number(sku.skuSupplyPrice) : '',
        listing_price: sku.skuListingPrice != null ? Number(sku.skuListingPrice) : '',
        selling_price: sku.skuSellingPrice != null ? Number(sku.skuSellingPrice) : '',
        fulfillment_fee: sku.skuFulfillmentFeeOverride != null ? Number(sku.skuFulfillmentFeeOverride) : '',
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importData(
    entId: string,
    fileBuffer: Buffer,
    fileMeta: { fileName: string; fileSize: number; userId?: string },
  ): Promise<{
    total: number;
    inserted: number;
    updated: number;
    errors: { row: number; field: string; message: string }[];
  }> {
    // Create upload history
    const history = await this.uploadHistoryService.create({
      entId,
      type: 'PRODUCT_MASTER',
      channel: 'N/A',
      fileName: fileMeta.fileName,
      fileSize: fileMeta.fileSize,
      createdBy: fileMeta.userId,
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as any);
    const ws = wb.getWorksheet(1);
    if (!ws) {
      await this.uploadHistoryService.fail(history.uphId, 'No worksheet found');
      throw new BusinessException('DRD-E2010', 'No worksheet found in file', HttpStatus.BAD_REQUEST);
    }

    // Parse rows (row 1 = header, row 2+ = data)
    const rows: Record<string, string | number | null>[] = [];
    const headerRow = ws.getRow(1);
    const headerMap = new Map<number, string>();
    headerRow.eachCell((cell, colNum) => {
      const val = String(cell.value ?? '').trim().toLowerCase();
      // Map header text to key
      const found = TEMPLATE_HEADERS.find(
        (h) => h.header.toLowerCase() === val || h.key === val,
      );
      if (found) headerMap.set(colNum, found.key);
    });

    ws.eachRow((row, rowNum) => {
      if (rowNum <= 1) return;
      const data: Record<string, string | number | null> = {};
      headerMap.forEach((key, colNum) => {
        const cell = row.getCell(colNum);
        data[key] = cell.value != null ? cell.value as string | number : null;
      });
      if (data.sku_wms_code) rows.push(data);
    });

    if (rows.length === 0) {
      await this.uploadHistoryService.fail(history.uphId, 'No data rows found');
      throw new BusinessException('DRD-E2011', 'No data rows found', HttpStatus.BAD_REQUEST);
    }

    let inserted = 0;
    let updated = 0;
    const errors: { row: number; field: string; message: string }[] = [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Build SPU map
      const existingSpus = await queryRunner.manager.find(SpuMasterEntity, {
        where: { entId, spuDeletedAt: IsNull() },
      });
      const spuMap = new Map(existingSpus.map((s) => [s.spuCode, s]));

      // Build SKU map
      const existingSkus = await queryRunner.manager.find(SkuMasterEntity, {
        where: { entId, skuDeletedAt: IsNull() },
      });
      const skuMap = new Map(existingSkus.map((s) => [s.skuWmsCode, s]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Excel row number
        const spuCode = String(row.spu_code ?? '').trim();
        const wmsCode = String(row.sku_wms_code ?? '').trim();

        if (!spuCode) {
          errors.push({ row: rowNum, field: 'spu_code', message: 'SPU code is required' });
          continue;
        }
        if (!wmsCode) {
          errors.push({ row: rowNum, field: 'sku_wms_code', message: 'WMS code is required' });
          continue;
        }

        // Ensure SPU exists
        let spu = spuMap.get(spuCode);
        if (!spu) {
          spu = queryRunner.manager.create(SpuMasterEntity, {
            entId,
            spuCode,
            spuBrandCode: String(row.brand_code ?? 'SB').trim() || 'SB',
            spuSubBrand: row.sub_brand ? String(row.sub_brand).trim() : null,
            spuNameKr: String(row.spu_name_kr ?? spuCode).trim(),
            spuNameEn: String(row.spu_name_en ?? spuCode).trim(),
            spuNameVi: String(row.spu_name_vi ?? spuCode).trim(),
            spuCategoryCode: row.category_code ? String(row.category_code).trim() : null,
            spuCategoryName: row.category_name ? String(row.category_name).trim() : null,
          });
          spu = await queryRunner.manager.save(spu);
          spuMap.set(spuCode, spu);
        }

        const toNum = (v: string | number | null | undefined): number | null => {
          if (v == null || v === '') return null;
          const n = Number(v);
          return isNaN(n) ? null : n;
        };

        const existingSku = skuMap.get(wmsCode);
        if (existingSku) {
          // UPDATE
          existingSku.skuSpuCode = spuCode;
          existingSku.spuId = spu.spuId;
          existingSku.skuNameKr = String(row.sku_name_kr ?? existingSku.skuNameKr).trim();
          existingSku.skuNameEn = String(row.sku_name_en ?? existingSku.skuNameEn).trim();
          existingSku.skuNameVi = String(row.sku_name_vi ?? existingSku.skuNameVi).trim();
          existingSku.skuVariantType = row.variant_type ? String(row.variant_type).trim() : existingSku.skuVariantType;
          existingSku.skuVariantValue = row.variant_value ? String(row.variant_value).trim() : existingSku.skuVariantValue;
          existingSku.skuSyncCode = row.sync_code ? String(row.sync_code).trim() : existingSku.skuSyncCode;
          existingSku.skuGtinCode = row.gtin_code ? String(row.gtin_code).trim() : existingSku.skuGtinCode;
          existingSku.skuHsCode = row.hs_code ? String(row.hs_code).trim() : existingSku.skuHsCode;
          if (toNum(row.weight_gram) != null) existingSku.skuWeightGram = toNum(row.weight_gram);
          if (toNum(row.prime_cost) != null) existingSku.skuPrimeCost = toNum(row.prime_cost)!;
          if (toNum(row.supply_price) != null) existingSku.skuSupplyPrice = toNum(row.supply_price);
          if (toNum(row.listing_price) != null) existingSku.skuListingPrice = toNum(row.listing_price);
          if (toNum(row.selling_price) != null) existingSku.skuSellingPrice = toNum(row.selling_price);
          if (toNum(row.fulfillment_fee) != null) existingSku.skuFulfillmentFeeOverride = toNum(row.fulfillment_fee);
          await queryRunner.manager.save(existingSku);
          updated++;
        } else {
          // INSERT
          const primeCost = toNum(row.prime_cost);
          if (primeCost == null) {
            errors.push({ row: rowNum, field: 'prime_cost', message: 'Prime cost is required for new SKU' });
            continue;
          }

          const newSku = queryRunner.manager.create(SkuMasterEntity, {
            entId,
            spuId: spu.spuId,
            skuWmsCode: wmsCode,
            skuSpuCode: spuCode,
            skuNameKr: String(row.sku_name_kr ?? wmsCode).trim(),
            skuNameEn: String(row.sku_name_en ?? wmsCode).trim(),
            skuNameVi: String(row.sku_name_vi ?? wmsCode).trim(),
            skuVariantType: row.variant_type ? String(row.variant_type).trim() : null,
            skuVariantValue: row.variant_value ? String(row.variant_value).trim() : null,
            skuSyncCode: row.sync_code ? String(row.sync_code).trim() : null,
            skuGtinCode: row.gtin_code ? String(row.gtin_code).trim() : null,
            skuHsCode: row.hs_code ? String(row.hs_code).trim() : null,
            skuWeightGram: toNum(row.weight_gram),
            skuPrimeCost: primeCost,
            skuSupplyPrice: toNum(row.supply_price),
            skuListingPrice: toNum(row.listing_price),
            skuSellingPrice: toNum(row.selling_price),
            skuFulfillmentFeeOverride: toNum(row.fulfillment_fee),
          });
          const saved = await queryRunner.manager.save(newSku);
          skuMap.set(wmsCode, saved);
          inserted++;
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const msg = error instanceof Error ? error.message : 'Unknown error';
      await this.uploadHistoryService.fail(history.uphId, msg).catch(() => {});
      throw new BusinessException('DRD-E2012', `Import failed: ${msg}`, HttpStatus.INTERNAL_SERVER_ERROR);
    } finally {
      await queryRunner.release();
    }

    // Update upload history
    await this.uploadHistoryService.complete(history.uphId, {
      rowCount: rows.length,
      successCount: inserted + updated,
      skipCount: 0,
      errorCount: errors.length,
      errorDetail: errors.length > 0 ? JSON.stringify(errors) : undefined,
    }).catch(() => {});

    return { total: rows.length, inserted, updated, errors };
  }
}
