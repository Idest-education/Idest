import { Prisma } from '@prisma/client';
import { SessionResponseDto } from 'src/session/dto/session-response.dto';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';


export class UserSummaryDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'user-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: "URL to the user's avatar image",
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  avatar_url?: string | null;

  @ApiPropertyOptional({
    description: 'Role of the user in the system',
    example: 'STUDENT',
    enum: ['STUDENT', 'TEACHER', 'ADMIN'],
  })
  @IsString()
  @IsOptional()
  role?: string;
}

export class ClassCountDto {
  @ApiProperty({
    description: 'Number of students enrolled in the class',
    example: 25,
  })
  @IsNumber()
  members: number;

  @ApiProperty({
    description: 'Number of teachers assigned to the class',
    example: 2,
  })
  @IsNumber()
  teachers: number;

  @ApiProperty({
    description: 'Number of sessions conducted for this class',
    example: 15,
  })
  @IsNumber()
  sessions: number;
}

export class ClassResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the class',
    example: 'class-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Name of the class',
    example: 'IELTS Preparation - Advanced Level',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug for the class',
    example: 'ielts-preparation-advanced-level',
  })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the class',
    example: 'This class focuses on advanced IELTS preparation techniques.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({
    description: 'Whether this is a group class or one-on-one',
    example: true,
  })
  @IsBoolean()
  is_group: boolean;

  @ApiPropertyOptional({
    description: 'Invite code for students to join the class',
    example: 'IELTS2025',
  })
  @IsString()
  @IsOptional()
  invite_code?: string;

  @ApiProperty({
    description: 'ID of the user who created the class',
    example: 'teacher-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  created_by: string;

  @ApiPropertyOptional({
    description: 'Class schedule information',
    example: {
      days: ['monday', 'wednesday', 'friday'],
      time: '10:00',
      duration: 90,
    },
    nullable: true,
  })
  @IsOptional()
  schedule?: Prisma.JsonValue | null;

  @ApiProperty({
    description: 'Information about the class creator',
    type: () => UserSummaryDto,
  })
  @ValidateNested()
  @Type(() => UserSummaryDto)
  creator: UserSummaryDto;

  @ApiProperty({
    description: 'Statistics about the class',
    type: () => ClassCountDto,
  })
  @ValidateNested()
  @Type(() => ClassCountDto)
  _count: ClassCountDto;
}

export class FullClassResponseDto extends ClassResponseDto {
  @ApiProperty({
    description: 'List of students enrolled in the class',
    type: [UserSummaryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserSummaryDto)
  members: UserSummaryDto[];

  @ApiProperty({
    description: 'List of teachers assigned to the class',
    type: [UserSummaryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserSummaryDto)
  teachers: UserSummaryDto[];

  @ApiProperty({
    description: 'List of sessions conducted for this class',
    type: [SessionResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionResponseDto)
  sessions: SessionResponseDto[];
}

export class UserClassesResponseDto {
  @ApiProperty({
    description: 'Classes created by the user',
    type: [FullClassResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullClassResponseDto)
  created: FullClassResponseDto[];

  @ApiProperty({
    description: 'Classes where the user is teaching',
    type: [FullClassResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullClassResponseDto)
  teaching: FullClassResponseDto[];

  @ApiProperty({
    description: 'Classes where the user is enrolled as a student',
    type: [FullClassResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullClassResponseDto)
  enrolled: FullClassResponseDto[];
}

export class PaginatedClassResponseDto {
  @ApiProperty({
    description: 'Array of classes for the current page',
    type: [ClassResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassResponseDto)
  data: ClassResponseDto[];

  @ApiProperty({
    description: 'Total number of classes matching the criteria',
    example: 150,
  })
  @IsNumber()
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  @IsNumber()
  totalPages: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @IsNumber()
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  @IsNumber()
  pageSize: number;
}
