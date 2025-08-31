import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('conversation')
@UseGuards(AuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  /**
   * Create a new conversation
   */
  @Post()
  async createConversation(
    @CurrentUser() user: userPayload,
    @Body() dto: CreateConversationDto,
  ): Promise<ResponseDto> {
    return this.conversationService.createConversation(user, dto);
  }

  /**
   * Get all conversations for the current user
   */
  @Get()
  async getUserConversations(
    @CurrentUser() user: userPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<ResponseDto> {
    return this.conversationService.getUserConversations(user.id, {
      cursor,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  /**
   * Get or create direct conversation with another user
   */
  @Get('direct/:userId')
  async getOrCreateDirectConversation(
    @Param('userId') otherUserId: string,
    @CurrentUser() user: userPayload,
  ): Promise<ResponseDto> {
    return this.conversationService.getOrCreateDirectConversation(
      user.id,
      otherUserId,
    );
  }

  /**
   * Get conversation details with messages
   */
  @Get(':id')
  async getConversationById(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<ResponseDto> {
    const messageLimit = limit ? parseInt(limit) : 50;
    const beforeDate = before ? new Date(before) : undefined;

    return this.conversationService.getConversationById(
      conversationId,
      user.id,
      messageLimit,
      beforeDate,
    );
  }

  /**
   * Get conversation messages (for pagination)
   */
  @Get(':id/messages')
  async getConversationMessages(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ResponseDto> {
    const messageLimit = limit ? parseInt(limit) : 50;
    const beforeDate = before ? new Date(before) : undefined;

    return this.conversationService.getConversationMessages(
      conversationId,
      user.id,
      messageLimit,
      beforeDate,
    );
  }

  /**
   * Send a message in a conversation
   */
  @Post(':id/messages')
  async sendMessage(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: SendMessageDto,
  ): Promise<ResponseDto> {
    return this.conversationService.sendMessage(conversationId, user.id, dto);
  }

  /**
   * Add participant to group conversation
   */
  @Post(':id/participants')
  async addParticipant(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: AddParticipantDto,
  ): Promise<ResponseDto> {
    return this.conversationService.addParticipant(
      conversationId,
      user.id,
      dto,
    );
  }

  /**
   * Remove participant from conversation
   */
  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @Param('id') conversationId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: userPayload,
  ): Promise<ResponseDto> {
    return this.conversationService.removeParticipant(
      conversationId,
      user.id,
      participantId,
    );
  }
}
