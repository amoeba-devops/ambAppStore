import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_receiving_schedules')
@Index('idx_asm_rcv_ent_sku', ['entId', 'skuId'])
export class ReceivingSchedule {
  @PrimaryGeneratedColumn('uuid', { name: 'rcv_id' })
  rcvId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'obt_id', type: 'char', length: 36, nullable: true })
  obtId: string | null;

  @Column({ name: 'rcv_expected_qty', type: 'int' })
  rcvExpectedQty: number;

  @Column({ name: 'rcv_received_qty', type: 'int', nullable: true })
  rcvReceivedQty: number | null;

  @Column({ name: 'rcv_expected_date', type: 'date' })
  rcvExpectedDate: string;

  @Column({ name: 'rcv_status', type: 'enum', enum: ['EXPECTED', 'ARRIVED', 'INSPECTING', 'COMPLETED', 'CANCELLED'], default: 'EXPECTED' })
  rcvStatus: string;

  @Column({ name: 'rcv_inspection_result', type: 'enum', enum: ['PASS', 'PARTIAL', 'FAIL'], nullable: true })
  rcvInspectionResult: string | null;

  @Column({ name: 'rcv_inspection_note', type: 'text', nullable: true })
  rcvInspectionNote: string | null;

  @Column({ name: 'rcv_supplier', type: 'varchar', length: 200, nullable: true })
  rcvSupplier: string | null;

  @Column({ name: 'rcv_note', type: 'text', nullable: true })
  rcvNote: string | null;

  @Column({ name: 'rcv_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  rcvCreatedAt: Date;

  @Column({ name: 'rcv_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  rcvUpdatedAt: Date;
}
