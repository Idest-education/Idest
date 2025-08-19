import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  replyToId?: string;

  @IsArray()
  @IsOptional()
  attachments?: Array<Record<string, any>>; // Store as JSON array
}
