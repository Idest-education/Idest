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
  id: string;
  sessionId: string;
  content: string;
  sentAt: Date;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}
