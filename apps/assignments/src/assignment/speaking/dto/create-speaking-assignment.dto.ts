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
} from 'class-validator';
import { MediaAssetDto } from '../../dto/objective/objective-assignment.dto';

export class CreateSpeakingPartItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  prompt_md: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  follow_up_prompts?: string[];

  @ApiProperty()
  @IsNumber()
  order_index: number;
}

export class CreateSpeakingCueCardDto {
  @ApiProperty()
  @IsString()
  topic_md: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  bullet_points: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  preparation_seconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  speaking_seconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation_md?: string;
}

export class CreateSpeakingPartDto {
  @ApiProperty({ enum: [1, 2, 3] })
  @IsIn([1, 2, 3])
  part_number: 1 | 2 | 3;

  @ApiPropertyOptional({ type: [CreateSpeakingPartItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpeakingPartItemDto)
  items?: CreateSpeakingPartItemDto[];

  @ApiPropertyOptional({ type: CreateSpeakingCueCardDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSpeakingCueCardDto)
  cue_card?: CreateSpeakingCueCardDto;

  @ApiPropertyOptional({ type: [MediaAssetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaAssetDto)
  media?: MediaAssetDto[];
}

export class CreateSpeakingAssignmentDto {
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

  @ApiProperty({ type: [CreateSpeakingPartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpeakingPartDto)
  parts: CreateSpeakingPartDto[];
}
