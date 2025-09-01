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

export class UserSummaryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  avatar_url?: string;
}

export class ConversationParticipantDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsDate()
  @Type(() => Date)
  joinedAt: Date;

  @ValidateNested()
  @Type(() => UserSummaryDto)
  user: UserSummaryDto;
}

export class MessageSenderDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsString()
  @IsOptional()
  avatar_url?: string;
}

export class ConversationSummaryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsBoolean()
  isGroup: boolean;
}

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsDate()
  @Type(() => Date)
  sentAt: Date;

  @IsString()
  @IsNotEmpty()
  senderId: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  replyToId?: string;

  @IsOptional()
  attachments?: any;

  @ValidateNested()
  @Type(() => MessageSenderDto)
  sender: MessageSenderDto;

  @ValidateNested()
  @Type(() => ConversationSummaryDto)
  @IsOptional()
  conversation?: ConversationSummaryDto;
}

export class ConversationCountDto {
  @IsNumber()
  messages: number;
}

export class ConversationDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsBoolean()
  isGroup: boolean;

  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @IsDate()
  @Type(() => Date)
  updatedAt: Date;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  createdBy: string;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsBoolean()
  isDeleted: boolean;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationParticipantDto)
  participants: ConversationParticipantDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ValidateNested()
  @Type(() => ConversationCountDto)
  @IsOptional()
  _count?: ConversationCountDto;
}

export class ConversationsListDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationDto)
  items: ConversationDto[];

  @IsString()
  @IsOptional()
  nextCursor?: string;
}

export class ConversationWithMessagesDto {
  @ValidateNested()
  @Type(() => ConversationDto)
  conversation: ConversationDto;

  @IsString()
  @IsOptional()
  nextCursor?: string;
}

export class MessagesListDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @IsBoolean()
  hasMore: boolean;

  @IsNumber()
  total: number;

  @IsString()
  @IsOptional()
  nextCursor?: string;
}
