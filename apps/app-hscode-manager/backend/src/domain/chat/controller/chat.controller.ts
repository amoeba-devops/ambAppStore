import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { PaginatedData, PaginationQuery } from '../../../common/dto/pagination.dto';
import { ChatService } from '../service/chat.service';
import { SendMessageRequest } from '../dto/request/send-message.request';
import { ChatMapper } from '../mapper/chat.mapper';
import {
  ChatHistoryResponse,
  ChatSessionResponse,
  SendMessageResponse,
} from '../dto/response/chat.response';

/**
 * Q&A 챗봇 (Phase 3, 역할 ①) — 자연어 질문 → RAG 근거 대화형 답변. 사용자 기능(@Auth, ent_id 격리).
 */
@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Auth()
  @Post('messages')
  @ApiOperation({ summary: '메시지 전송 → RAG 근거 대화형 답변 (R3)' })
  async send(
    @Body() dto: SendMessageRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<SendMessageResponse>> {
    const result = await this.chat.send(entId, userId, dto.session_id, dto.message);
    return successResponse({
      session: ChatMapper.toSessionResponse(result.session),
      userMessage: ChatMapper.toMessageResponse(result.userMessage),
      assistantMessage: ChatMapper.toMessageResponse(result.assistantMessage),
    });
  }

  @Auth()
  @Get('sessions')
  @ApiOperation({ summary: '대화 세션 목록(이력)' })
  async listSessions(
    @Query() query: PaginationQuery,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<PaginatedData<ChatSessionResponse>>> {
    const result = await this.chat.listSessions(entId, query.page, query.size);
    return successResponse({
      ...result,
      items: ChatMapper.toSessionListResponse(result.items),
    });
  }

  @Auth()
  @Get('sessions/:id')
  @ApiOperation({ summary: '세션 메시지 이력' })
  async getMessages(
    @Param('id') id: string,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<ChatHistoryResponse>> {
    const { session, messages } = await this.chat.getMessages(entId, id);
    return successResponse({
      session: ChatMapper.toSessionResponse(session),
      messages: ChatMapper.toMessageListResponse(messages),
    });
  }
}
