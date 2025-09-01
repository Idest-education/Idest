import { JsonValue } from 'generated/prisma/runtime/library';
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

export class UserSummaryDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  avatar_url?: string | null;

  @IsString()
  @IsOptional()
  role?: string;
}

export class ClassCountDto {
  @IsNumber()
  members: number;

  @IsNumber()
  teachers: number;

  @IsNumber()
  sessions: number;
}

export class ClassResponseDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsBoolean()
  is_group: boolean;

  @IsString()
  @IsOptional()
  invite_code?: string;

  @IsString()
  @IsNotEmpty()
  created_by: string;

  @IsOptional()
  schedule?: JsonValue | null;

  @ValidateNested()
  @Type(() => UserSummaryDto)
  creator: UserSummaryDto;

  @ValidateNested()
  @Type(() => ClassCountDto)
  _count: ClassCountDto;
}

export class FullClassResponseDto extends ClassResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserSummaryDto)
  members: UserSummaryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserSummaryDto)
  teachers: UserSummaryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SessionResponseDto)
  sessions: SessionResponseDto[];
}

export class UserClassesResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullClassResponseDto)
  created: FullClassResponseDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullClassResponseDto)
  teaching: FullClassResponseDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FullClassResponseDto)
  enrolled: FullClassResponseDto[];
}

export class PaginatedClassResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassResponseDto)
  data: ClassResponseDto[];

  @IsNumber()
  total: number;

  @IsNumber()
  totalPages: number;

  @IsNumber()
  page: number;

  @IsNumber()
  pageSize: number;
}
