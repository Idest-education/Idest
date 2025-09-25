import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsIn, ValidateNested, IsArray, IsUUID, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSpeakingQuestionDto {
  @ApiProperty()
  @IsString()
  prompt: string;

  @ApiProperty()
  @IsNumber()
  order_index: number;
}

export class CreateSpeakingPartDto {
  @ApiProperty()
  @IsNumber()
  @IsIn([1, 2, 3])
  part_number: number;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ type: [CreateSpeakingQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpeakingQuestionDto)
  questions: CreateSpeakingQuestionDto[];
}

export class CreateSpeakingAssignmentDto {
  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ type: [CreateSpeakingPartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSpeakingPartDto)
  parts: CreateSpeakingPartDto[];
}


