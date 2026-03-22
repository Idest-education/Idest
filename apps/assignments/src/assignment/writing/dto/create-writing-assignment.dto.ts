import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsIn,
  IsObject,
} from 'class-validator';
import { MediaAssetDto } from '../../dto/objective/objective-assignment.dto';

export class WritingTaskWordLimitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  target?: number;
}

export class WritingTaskStimulusDto {
  @ApiPropertyOptional({ type: [MediaAssetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaAssetDto)
  images?: MediaAssetDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  data_description_md?: string;
}

export class WritingTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ enum: [1, 2] })
  @IsIn([1, 2])
  task_number: 1 | 2;

  @ApiProperty({ enum: ['academic', 'general_training'] })
  @IsIn(['academic', 'general_training'])
  format: 'academic' | 'general_training';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  task_kind?: string;

  @ApiProperty()
  @IsString()
  prompt_md: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions_md?: string;

  @ApiPropertyOptional({ type: WritingTaskWordLimitDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WritingTaskWordLimitDto)
  word_limit?: WritingTaskWordLimitDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  recommended_minutes?: number;

  @ApiPropertyOptional({ type: WritingTaskStimulusDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WritingTaskStimulusDto)
  stimulus?: WritingTaskStimulusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rubric_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  criteria_weights?: Record<string, number>;
}

export class CreateWritingAssignmentDto {
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

  @ApiProperty({ type: [WritingTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WritingTaskDto)
  tasks: WritingTaskDto[];
}
