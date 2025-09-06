import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'The message content to send',
    example: 'Hello everyone! How is the study going?',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description:
      'ID of the message this is replying to (for threaded conversations)',
    example: 'message-uuid-here',
  })
  @IsString()
  @IsOptional()
  replyToId?: string;

  @ApiPropertyOptional({
    description: 'Array of file attachments or media objects',
    example: [
      {
        type: 'image',
        url: 'https://example.com/image.jpg',
        filename: 'screenshot.jpg',
        size: 1024000,
      },
    ],
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', example: 'image' },
        url: { type: 'string', example: 'https://example.com/file.jpg' },
        filename: { type: 'string', example: 'document.pdf' },
        size: { type: 'number', example: 1024000 },
      },
    },
  })
  @IsArray()
  @IsOptional()
  attachments?: Array<Record<string, any>>; // Store as JSON array
}
