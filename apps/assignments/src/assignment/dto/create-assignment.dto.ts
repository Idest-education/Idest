import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  IsUUID,
} from 'class-validator';

export class CreateSubquestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subprompt?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  options: string[];

  @ApiProperty()
  answer: string | number | string[] | number[] | boolean;
}

export class CreateQuestionDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty({ enum: ['fill_blank', 'multiple_choice', 'matching', 'map_labeling', 'true_false'] })
  @IsEnum(['fill_blank', 'multiple_choice', 'matching', 'map_labeling', 'true_false'])
  type: string;

  @ApiProperty()
  @IsString()
  prompt: string;

  @ApiProperty({ type: [CreateSubquestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubquestionDto)
  subquestions: CreateSubquestionDto[];
}

export class CreateReadingMaterialDto {
  @ApiProperty()
  @IsString()
  document: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image_url?: string;
}

export class CreateListeningMaterialDto {
  @ApiProperty()
  @IsString()
  audio_url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcript?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image_url?: string;
}

export class CreateSectionDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsNumber()
  order_index: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  material_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateReadingMaterialDto)
  reading_material?: CreateReadingMaterialDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateListeningMaterialDto)
  listening_material?: CreateListeningMaterialDto;

  @ApiProperty({ type: [CreateQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}

export class CreateAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  created_by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  class_id?: string;

  @ApiProperty({ enum: ['reading', 'listening', 'writing', 'speaking'] })
  @IsEnum(['reading', 'listening', 'writing', 'speaking'])
  skill: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsBoolean()
  is_public: boolean;

  @ApiProperty({ type: [CreateSectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionDto)
  sections: CreateSectionDto[];
}
