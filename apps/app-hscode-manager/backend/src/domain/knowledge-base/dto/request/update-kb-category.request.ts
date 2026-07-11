import { PartialType } from '@nestjs/swagger';
import { CreateKbCategoryRequest } from './create-kb-category.request';

/** 카테고리 수정 요청 — 전 필드 선택적. FR-KB-015 */
export class UpdateKbCategoryRequest extends PartialType(CreateKbCategoryRequest) {}
