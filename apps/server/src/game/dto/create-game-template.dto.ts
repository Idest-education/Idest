import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
  ValidateIf,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export enum QuestionTypeDto {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  FILL_BLANK = 'FILL_BLANK',
  MULTI_CHOICE = 'MULTI_CHOICE',
  MATCH_LR = 'MATCH_LR',
  WORD_CLOUD = 'WORD_CLOUD',
}

export class GameOptionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ example: 'Joyful' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class GameMatchPairDto {
  @ApiProperty({ example: 'Capital of France' })
  @IsString()
  @IsNotEmpty()
  leftText: string;

  @ApiProperty({ example: 'Paris' })
  @IsString()
  @IsNotEmpty()
  rightText: string;
}

export class CreateGameQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ enum: QuestionTypeDto })
  @IsEnum(QuestionTypeDto)
  type: QuestionTypeDto;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(5)
  @Max(120)
  timerSeconds: number;

  @ApiProperty({ example: 'Joyful' })
  @IsString()
  // WORD_CLOUD and MATCH_LR don't use a correctAnswer
  @ValidateIf((o) => o.type !== QuestionTypeDto.WORD_CLOUD && o.type !== QuestionTypeDto.MATCH_LR)
  @IsNotEmpty()
  correctAnswer: string;

  @ApiPropertyOptional({ type: [GameOptionDto] })
  @ValidateIf(
    (o) => o.type === QuestionTypeDto.MULTIPLE_CHOICE || o.type === QuestionTypeDto.MULTI_CHOICE,
  )
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GameOptionDto)
  options?: GameOptionDto[];

  @ApiPropertyOptional({ type: [GameMatchPairDto] })
  @ValidateIf((o) => o.type === QuestionTypeDto.MATCH_LR)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => GameMatchPairDto)
  matchPairs?: GameMatchPairDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isMultiAnswer?: boolean;
}

export class CreateGameTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateGameQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateGameQuestionDto)
  questions: CreateGameQuestionDto[];
}
