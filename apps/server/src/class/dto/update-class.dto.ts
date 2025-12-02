import { IsOptional, IsString, IsObject, IsBoolean, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClassDto {
  @ApiPropertyOptional({
    description: 'Updated name of the class',
    example: 'IELTS Preparation - Expert Level',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated description of the class',
    example:
      'This expert-level class focuses on achieving band scores of 8+ in all IELTS sections.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a group class (true) or one-on-one (false)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_group?: boolean;

  @ApiPropertyOptional({
    description:
      'Updated price of the class in Vietnamese đồng (VND). Null/undefined means the class is free.',
    example: 600000,
  })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: 'Updated class schedule information',
    example: {
      days: ['tuesday', 'thursday'],
      time: '14:00',
      duration: 120,
      timezone: 'UTC',
      recurring: true,
    },
  })
  @IsObject()
  @IsOptional()
  schedule?: any;
}
