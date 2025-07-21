import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class GetMeetingMessagesDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsDateString()
  before?: string; // ISO date string
}

export class GetClassroomMessagesDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsDateString()
  before?: string; // ISO date string
}

export class MessageHistoryResponseDto {
  id: string;
  content: string;
  sentAt: Date;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export class MessageHistoryListDto {
  messages: MessageHistoryResponseDto[];
  hasMore: boolean;
  total: number;
}
