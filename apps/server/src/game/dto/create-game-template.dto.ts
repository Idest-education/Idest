import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
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
  @IsNotEmpty()
  correctAnswer: string;

  @ApiPropertyOptional({ type: [GameOptionDto] })
  @ValidateIf((o) => o.type === QuestionTypeDto.MULTIPLE_CHOICE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GameOptionDto)
  options?: GameOptionDto[];
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
  @ValidateNested({ each: true })
  @Type(() => CreateGameQuestionDto)
  questions: CreateGameQuestionDto[];
}
