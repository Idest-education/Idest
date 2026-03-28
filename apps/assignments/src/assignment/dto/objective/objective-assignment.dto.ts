import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsIn,
  IsObject,
} from 'class-validator';
import { OBJECTIVE_QUESTION_TYPES } from '../../schemas/shared/objective-shared.schema';
import type { ObjectiveAnswerKey, ObjectiveInteraction } from '../../schemas/shared/objective-interaction-answer.schema';

const QUESTION_TYPES_LIST = [...OBJECTIVE_QUESTION_TYPES] as string[];

export class MediaAssetDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ enum: ['image', 'audio', 'file'] })
  @IsIn(['image', 'audio', 'file'])
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

  @ApiProperty()
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

  @ApiProperty({ enum: QUESTION_TYPES_LIST })
  @IsIn(QUESTION_TYPES_LIST)
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt_md?: string;

  @ApiPropertyOptional({
    type: StimulusDto,
    description:
      'Optional per-question stimulus; use QuestionGroup.stimulus for shared images/diagrams for the whole group.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StimulusDto)
  stimulus?: StimulusDto;

  @ApiProperty({
    description:
      'UI payload by question type: options (MC), blanks (gap/form), left/right (matching), etc. See GapFillTemplateInteraction, MultipleChoiceSingleInteraction, … in objective-interaction-answer.schema.ts',
  })
  @IsObject()
  interaction: ObjectiveInteraction;

  @ApiProperty({
    description:
      'Correct answers; shape matches `type` and grading-objective.util.ts (blanks, choice, choices, map, correct_answer, …)',
  })
  @IsObject()
  answer_key: ObjectiveAnswerKey;
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

  @ApiPropertyOptional({
    type: StimulusDto,
    description:
      'Shared stimulus for the whole group (e.g. image to label, map, diagram). Questions 14–20 on one figure.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StimulusDto)
  stimulus?: StimulusDto;

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

  @ApiProperty()
  @ValidateNested()
  @Type(() => Object)
  material: ReadingSectionMaterialDto | ListeningSectionMaterialDto;

  @ApiProperty({ type: [QuestionGroupDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionGroupDto)
  question_groups: QuestionGroupDto[];
}

export class CreateObjectiveAssignmentBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  created_by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  class_id?: string;

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
