import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsDate,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSummaryDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: "URL to the user's avatar image",
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  avatar_url?: string;
}

export class ConversationParticipantDto {
  @ApiProperty({
    description: 'Unique identifier for the participant record',
    example: 'participant-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'ID of the user who is a participant',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'ID of the conversation',
    example: 'conversation-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'Timestamp when the user joined the conversation',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  joinedAt: Date;

  @ApiProperty({
    description: 'User details for this participant',
    type: () => UserSummaryDto,
  })
  @ValidateNested()
  @Type(() => UserSummaryDto)
  user: UserSummaryDto;
}

export class MessageSenderDto {
  @ApiProperty({
    description: 'Unique identifier for the message sender',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Full name of the message sender',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiPropertyOptional({
    description: "URL to the sender's avatar image",
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  avatar_url?: string;
}

export class ConversationSummaryDto {
  @ApiProperty({
    description: 'Unique identifier for the conversation',
    example: 'conversation-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Whether this is a group conversation',
    example: false,
  })
  @IsBoolean()
  isGroup: boolean;
}

export class MessageDto {
  @ApiProperty({
    description: 'Unique identifier for the message',
    example: 'message-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'The message content',
    example: 'Hello everyone! How is the study going?',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    enum: MessageType,
    description: 'Type of the message',
    example: MessageType.DIRECT,
    enumName: 'MessageType',
  })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiProperty({
    description: 'Timestamp when the message was sent',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  sentAt: Date;

  @ApiProperty({
    description: 'ID of the user who sent the message',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  senderId: string;

  @ApiPropertyOptional({
    description: 'ID of the conversation this message belongs to',
    example: 'conversation-uuid-here',
  })
  @IsString()
  @IsOptional()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'ID of the message this is replying to',
    example: 'message-uuid-here',
  })
  @IsString()
  @IsOptional()
  replyToId?: string;

  @ApiPropertyOptional({
    description: 'File attachments or media objects',
    example: [
      {
        type: 'image',
        url: 'https://example.com/image.jpg',
        filename: 'screenshot.jpg',
        size: 1024000,
      },
    ],
  })
  @IsOptional()
  attachments?: any;

  @ApiProperty({
    description: 'Details about the message sender',
    type: () => MessageSenderDto,
  })
  @ValidateNested()
  @Type(() => MessageSenderDto)
  sender: MessageSenderDto;

  @ApiPropertyOptional({
    description: 'Summary of the conversation this message belongs to',
    type: () => ConversationSummaryDto,
  })
  @ValidateNested()
  @Type(() => ConversationSummaryDto)
  @IsOptional()
  conversation?: ConversationSummaryDto;
}

export class ConversationCountDto {
  @ApiProperty({
    description: 'Number of messages in the conversation',
    example: 42,
  })
  @IsNumber()
  messages: number;
}

export class ConversationDto {
  @ApiProperty({
    description: 'Unique identifier for the conversation',
    example: 'conversation-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Whether this is a group conversation or direct message',
    example: false,
  })
  @IsBoolean()
  isGroup: boolean;

  @ApiProperty({
    description: 'Timestamp when the conversation was created',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the conversation was last updated',
    example: '2025-01-01T00:00:00.000Z',
    format: 'date-time',
  })
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Title of the conversation (for group conversations)',
    example: 'Study Group Discussion',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL for the conversation (typically group chats)',
    example: 'https://example.com/group-avatar.png',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  avatar_url?: string;

  @ApiProperty({
    description: 'ID of the user who created the conversation',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @ApiPropertyOptional({
    description:
      'ID of the user who owns the conversation (for class-based conversations)',
    example: 'teacher-uuid-here',
  })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiProperty({
    description: 'Whether the conversation has been deleted',
    example: false,
  })
  @IsBoolean()
  isDeleted: boolean;

  @ApiPropertyOptional({
    description: 'ID of the class this conversation belongs to',
    example: 'class-uuid-here',
  })
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiProperty({
    description: 'List of conversation participants',
    type: [ConversationParticipantDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationParticipantDto)
  participants: ConversationParticipantDto[];

  @ApiProperty({
    description: 'Recent messages in the conversation',
    type: [MessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({
    description: 'Message count and other statistics',
    type: () => ConversationCountDto,
  })
  @ValidateNested()
  @Type(() => ConversationCountDto)
  @IsOptional()
  _count?: ConversationCountDto;
}

export class ConversationsListDto {
  @ApiProperty({
    description: 'List of conversations',
    type: [ConversationDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationDto)
  items: ConversationDto[];

  @ApiPropertyOptional({
    description: 'Cursor for pagination (next page)',
    example: 'cursor-string-here',
  })
  @IsString()
  @IsOptional()
  nextCursor?: string;
}

export class ConversationWithMessagesDto {
  @ApiProperty({
    description: 'The conversation with its messages',
    type: () => ConversationDto,
  })
  @ValidateNested()
  @Type(() => ConversationDto)
  conversation: ConversationDto;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (next page of messages)',
    example: 'cursor-string-here',
  })
  @IsString()
  @IsOptional()
  nextCursor?: string;
}

export class MessagesListDto {
  @ApiProperty({
    description: 'List of messages',
    type: [MessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiProperty({
    description: 'Whether there are more messages available',
    example: true,
  })
  @IsBoolean()
  hasMore: boolean;

  @ApiProperty({
    description: 'Total number of messages in the conversation',
    example: 150,
  })
  @IsNumber()
  total: number;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (next page of messages)',
    example: 'cursor-string-here',
  })
  @IsString()
  @IsOptional()
  nextCursor?: string;
}
