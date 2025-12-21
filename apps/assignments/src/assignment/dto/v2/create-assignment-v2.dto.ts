import { ApiProperty, ApiPropertyOptional, ApiExtraModels } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsIn,
  IsObject,
} from 'class-validator';

/**
 * DTOs for Assignment Schema V2.
 * Backward incompatible with v1.
 */

export class MediaAssetDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ enum: ['image', 'audio', 'file'] })
  @IsEnum(['image', 'audio', 'file'])
  kind: 'image' | 'audio' | 'file';

  @ApiProperty()
  @IsString()
  url: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  duration_seconds?: number;
}

export class StimulusTemplateBlankDto {
  @ApiProperty()
  @IsString()
  blank_id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholder_label?: string;
}

export class StimulusTemplateDto {
  @ApiProperty({ enum: ['text'] })
  @IsIn(['text'])
  format: 'text';

  @ApiProperty({ description: 'Template body with placeholders like {{blank:1}}' })
  @IsString()
  body: string;

  @ApiProperty({ type: [StimulusTemplateBlankDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StimulusTemplateBlankDto)
  blanks: StimulusTemplateBlankDto[];
}

export class StimulusDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions_md?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content_md?: string;

  @ApiPropertyOptional({ type: [MediaAssetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaAssetDto)
  media?: MediaAssetDto[];

  @ApiPropertyOptional({ type: StimulusTemplateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StimulusTemplateDto)
  template?: StimulusTemplateDto;
}

export class QuestionDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsNumber()
  order_index: number;

  @ApiProperty({
    enum: [
      'gap_fill_template',
      'multiple_choice_single',
      'multiple_choice_multi',
      'true_false_not_given',
      'matching',
      'diagram_labeling',
      'short_answer',
    ],
  })
  @IsEnum([
    'gap_fill_template',
    'multiple_choice_single',
    'multiple_choice_multi',
    'true_false_not_given',
    'matching',
    'diagram_labeling',
    'short_answer',
  ])
  type:
    | 'gap_fill_template'
    | 'multiple_choice_single'
    | 'multiple_choice_multi'
    | 'true_false_not_given'
    | 'matching'
    | 'diagram_labeling'
    | 'short_answer';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt_md?: string;

  @ApiProperty({ type: StimulusDto })
  @ValidateNested()
  @Type(() => StimulusDto)
  stimulus: StimulusDto;

  @ApiProperty({ description: 'Type-specific interaction payload' })
  @IsObject()
  interaction: any;

  @ApiProperty({ description: 'Type-specific answer key payload' })
  @IsObject()
  answer_key: any;
}

export class QuestionGroupDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsNumber()
  order_index: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions_md?: string;

  @ApiProperty({ type: [QuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions: QuestionDto[];
}

export class ReadingSectionMaterialDto {
  @ApiProperty({ enum: ['reading'] })
  @IsIn(['reading'])
  type: 'reading';

  @ApiProperty()
  @IsString()
  document_md: string;

  @ApiPropertyOptional({ type: [MediaAssetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaAssetDto)
  images?: MediaAssetDto[];
}

export class ListeningSectionMaterialDto {
  @ApiProperty({ enum: ['listening'] })
  @IsIn(['listening'])
  type: 'listening';

  @ApiProperty({ type: MediaAssetDto })
  @ValidateNested()
  @Type(() => MediaAssetDto)
  audio: MediaAssetDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transcript_md?: string;

  @ApiPropertyOptional({ type: [MediaAssetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaAssetDto)
  images?: MediaAssetDto[];
}

export class SectionDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsNumber()
  order_index: number;

  @ApiProperty({
    description: 'Discriminated by `type`: reading or listening',
    oneOf: [
      { $ref: '#/components/schemas/ReadingSectionMaterialDto' },
      { $ref: '#/components/schemas/ListeningSectionMaterialDto' },
    ],
  })
  @ValidateNested()
  @Type(() => Object)
  material: ReadingSectionMaterialDto | ListeningSectionMaterialDto;

  @ApiProperty({ type: [QuestionGroupDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionGroupDto)
  question_groups: QuestionGroupDto[];
}

export class CreateAssignmentV2Dto {
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
  skill: 'reading' | 'listening' | 'writing' | 'speaking';

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

  @ApiProperty({ type: [SectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections: SectionDto[];
}


