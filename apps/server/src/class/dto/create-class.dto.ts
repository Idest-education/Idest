import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClassDto {
  @ApiProperty({
    description: 'Name of the class',
    example: 'IELTS Preparation - Advanced Level',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Detailed description of the class',
    example:
      'This class focuses on advanced IELTS preparation techniques including all four skills: listening, reading, writing, and speaking.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Whether this is a group class (true) or one-on-one (false)',
    example: true,
  })
  @IsBoolean()
  is_group: boolean;

  @ApiPropertyOptional({
    description:
      'Class schedule information including meeting times and frequency',
    example: {
      days: ['monday', 'wednesday', 'friday'],
      time: '10:00',
      duration: 90,
      timezone: 'UTC',
      recurring: true,
    },
  })
  @IsObject()
  @IsOptional()
  schedule?: any; // JSON object for class schedule

  @ApiPropertyOptional({
    description:
      'Custom invite code for the class (auto-generated if not provided)',
    example: 'IELTS2025',
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  invite_code?: string; // Auto-generated if not provided

  // slug is auto-generated from name in service
}
