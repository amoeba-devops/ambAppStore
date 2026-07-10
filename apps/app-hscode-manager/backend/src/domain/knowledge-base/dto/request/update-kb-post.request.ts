import { PartialType } from '@nestjs/swagger';
import { CreateKbPostRequest } from './create-kb-post.request';

/** 게시글 수정 요청 — 전 필드 선택적. FR-KB-003 */
export class UpdateKbPostRequest extends PartialType(CreateKbPostRequest) {}
