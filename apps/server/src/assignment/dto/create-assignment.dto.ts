import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsNumber,
  IsNotEmpty,
  IsUrl,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SkillType {
  READING = 'reading',
  LISTENING = 'listening',
  WRITING = 'writing',
  SPEAKING = 'speaking',
}

export enum QuestionType {
  FILL_BLANK = 'fill_blank',
  MULTIPLE_CHOICE = 'multiple_choice',
  MATCHING = 'matching',
  MAP_LABELING = 'map_labeling',
  TRUE_FALSE = 'true_false',
}

export class CreateSubquestionDto {
  @IsOptional()
  @IsString()
  subprompt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsNotEmpty()
  answer: string | number | string[] | number[] | boolean;
}

export class CreateQuestionDto {

  @IsEnum(QuestionType)
  @IsNotEmpty()
  type: QuestionType;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubquestionDto)
  subquestions?: CreateSubquestionDto[];
}

export class CreateReadingMaterialDto {
  @IsString()
  @IsNotEmpty()
  document: string;

  @IsOptional()
  @IsString()
  image_url?: string;
}

export class CreateListeningMaterialDto {
  @IsString()
  @IsNotEmpty()
  audio_url: string;

  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsString()
  image_url?: string;
}

export class CreateSectionDto {

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsNotEmpty()
  order_index: number;

  @IsOptional()
  @IsString()
  material_url?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateReadingMaterialDto)
  reading_material?: CreateReadingMaterialDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateListeningMaterialDto)
  listening_material?: CreateListeningMaterialDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}

export class CreateAssignmentDto {
  @IsString()
  @IsNotEmpty()
  created_by: string;

  @IsOptional()
  @IsString()
  class_id?: string;

  @IsEnum(SkillType)
  @IsNotEmpty()
  skill: SkillType;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSectionDto)
  sections?: CreateSectionDto[];
}
