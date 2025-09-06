import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({
    description: 'ID of the class this session belongs to',
    example: 'class-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  class_id: string;

  @ApiProperty({
    description: 'Start time of the session',
    example: '2025-01-15T10:00:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsNotEmpty()
  start_time: string; // ISO date string

  @ApiPropertyOptional({
    description: 'End time of the session (if predetermined)',
    example: '2025-01-15T11:30:00.000Z',
    format: 'date-time',
  })
  @IsDateString()
  @IsOptional()
  end_time?: string; // ISO date string

  @ApiPropertyOptional({
    description: 'Whether this session should be recorded',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_recorded?: boolean = false;

  @ApiPropertyOptional({
    description: 'Additional metadata for the session',
    example: {
      topic: 'IELTS Writing Task 1',
      materials: ['graphs', 'charts'],
      difficulty: 'intermediate',
    },
  })
  @IsObject()
  @IsOptional()
  metadata?: any; // Additional session metadata
}
