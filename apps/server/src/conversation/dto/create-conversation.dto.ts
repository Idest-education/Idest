import {
  IsBoolean,
  IsOptional,
  IsArray,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Whether this is a group conversation or direct message',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isGroup?: boolean = false;

  @ApiProperty({
    description:
      'Array of user IDs to include as participants in the conversation',
    example: ['user-id-1', 'user-id-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  participantIds: string[];

  @ApiPropertyOptional({
    description:
      'Title for the conversation (required for group conversations)',
    example: 'Study Group Discussion',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'ID of the class this conversation belongs to',
    example: 'class-uuid-here',
  })
  @IsString()
  @IsOptional()
  classId?: string;

  @ApiPropertyOptional({
    description:
      'ID of the user who owns this conversation (for class-based conversations)',
    example: 'teacher-uuid-here',
  })
  @IsString()
  @IsOptional()
  ownerId?: string;
}
