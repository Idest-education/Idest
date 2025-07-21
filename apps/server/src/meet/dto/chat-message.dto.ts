import { IsNotEmpty, IsString } from 'class-validator';

export class ChatMessageDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

export class ChatMessageResponseDto {
  sessionId: string;
  message: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  timestamp: Date;
}
