import { Module } from '@nestjs/common';

/**
 * Phase 0~6 완료 시점 — 모든 placeholder 엔티티가 정식 모듈로 승격됨.
 * 본 모듈은 향후 신규 *임시 엔티티* 추가 시 활용한다.
 */
@Module({})
export class PlaceholderModule {}
