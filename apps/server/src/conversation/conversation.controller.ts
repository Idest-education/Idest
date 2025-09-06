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
import { CreateConversationDto } from './dto/create-conversation.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ConversationDto,
  ConversationsListDto,
  ConversationWithMessagesDto,
  MessageDto,
  ConversationParticipantDto,
  MessagesListDto,
} from './dto/conversation-response.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
  ApiUnprocessableEntityResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@Controller('conversation')
@ApiTags('Conversation')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({
    summary: 'Create conversation',
    description:
      'Creates a new conversation (direct message or group chat) with specified participants.',
  })
  @ApiBody({ type: CreateConversationDto })
  @ApiOkResponse({
    description: 'Conversation successfully created',
    type: ConversationDto,
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Failed to create conversation - validation errors or invalid participants',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createConversation(
    @CurrentUser() user: userPayload,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationDto> {
    return this.conversationService.createConversation(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user conversations',
    description:
      'Retrieves all conversations for the authenticated user with pagination support.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination',
    example: 'cursor-string-here',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of conversations to retrieve (max 100)',
    example: 20,
  })
  @ApiOkResponse({
    description: 'Successfully retrieved user conversations',
    type: ConversationsListDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getUserConversations(
    @CurrentUser() user: userPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<ConversationsListDto> {
    return this.conversationService.getUserConversations(user.id, {
      cursor,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('direct/:userId')
  @ApiOperation({
    summary: 'Get or create direct conversation',
    description:
      'Gets an existing direct conversation with another user or creates one if it does not exist.',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID of the user to start/get direct conversation with',
    example: 'user-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved or created direct conversation',
    type: ConversationDto,
  })
  @ApiNotFoundResponse({ description: 'Target user not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getOrCreateDirectConversation(
    @Param('userId') otherUserId: string,
    @CurrentUser() user: userPayload,
  ): Promise<ConversationDto> {
    return this.conversationService.getOrCreateDirectConversation(
      user.id,
      otherUserId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get conversation by ID',
    description:
      'Retrieves a specific conversation with its messages and participants.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: 'conversation-uuid-here',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of recent messages to include (max 100)',
    example: 30,
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Get messages before this timestamp (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved conversation',
    type: ConversationWithMessagesDto,
  })
  @ApiNotFoundResponse({
    description: 'Conversation not found or access denied',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getConversationById(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<ConversationWithMessagesDto> {
    const messageLimit = limit ? parseInt(limit) : 50;
    const beforeDate = before ? new Date(before) : undefined;

    return this.conversationService.getConversationById(
      conversationId,
      user.id,
      messageLimit,
      beforeDate,
    );
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Get conversation messages',
    description:
      'Retrieves messages from a conversation with pagination support.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: 'conversation-uuid-here',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of messages to retrieve (max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Get messages before this timestamp (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination',
    example: 'cursor-string-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved conversation messages',
    type: MessagesListDto,
  })
  @ApiNotFoundResponse({
    description: 'Conversation not found or access denied',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getConversationMessages(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Query('cursor') cursor?: string,
  ): Promise<MessagesListDto> {
    const messageLimit = limit ? parseInt(limit) : 50;
    const beforeDate = before ? new Date(before) : undefined;

    return this.conversationService.getConversationMessages(
      conversationId,
      user.id,
      messageLimit,
      beforeDate,
    );
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Send message',
    description:
      'Sends a new message in a conversation. Can include attachments and reply to other messages.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: 'conversation-uuid-here',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiOkResponse({
    description: 'Message successfully sent',
    type: MessageDto,
  })
  @ApiNotFoundResponse({
    description: 'Conversation not found or access denied',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to send message - validation errors',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async sendMessage(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    return this.conversationService.sendMessage(conversationId, user.id, dto);
  }

  @Post(':id/participants')
  @ApiOperation({
    summary: 'Add participant',
    description:
      'Adds a new participant to a group conversation. Only works for group conversations.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: 'conversation-uuid-here',
  })
  @ApiBody({ type: AddParticipantDto })
  @ApiOkResponse({
    description: 'Participant successfully added',
    type: ConversationParticipantDto,
  })
  @ApiNotFoundResponse({ description: 'Conversation or user not found' })
  @ApiForbiddenResponse({
    description:
      'Access denied - not a group conversation or insufficient permissions',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to add participant - user already in conversation',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async addParticipant(
    @Param('id') conversationId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: AddParticipantDto,
  ): Promise<ConversationParticipantDto> {
    return this.conversationService.addParticipant(
      conversationId,
      user.id,
      dto,
    );
  }

  @Delete(':id/participants/:participantId')
  @ApiOperation({
    summary: 'Remove participant',
    description:
      'Removes a participant from a group conversation. Users can remove themselves, or conversation owners can remove others.',
  })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID',
    example: 'conversation-uuid-here',
  })
  @ApiParam({
    name: 'participantId',
    description: 'ID of the user to remove from the conversation',
    example: 'user-uuid-here',
  })
  @ApiOkResponse({
    description: 'Participant successfully removed',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'Conversation or participant not found' })
  @ApiForbiddenResponse({
    description:
      'Access denied - insufficient permissions to remove participant',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Failed to remove participant - cannot remove last participant',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async removeParticipant(
    @Param('id') conversationId: string,
    @Param('participantId') participantId: string,
    @CurrentUser() user: userPayload,
  ): Promise<boolean> {
    return this.conversationService.removeParticipant(
      conversationId,
      user.id,
      participantId,
    );
  }
}
