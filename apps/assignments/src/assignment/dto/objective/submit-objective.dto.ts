import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

export class QuestionAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({ description: 'Type-specific answer payload' })
  @IsObject()
  answer: any;
}

export class SectionAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  section_id: string;

  @ApiProperty({ type: [QuestionAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  answers: QuestionAnswerDto[];
}

export class SubmitObjectiveAssignmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  assignment_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  submitted_by: string;

  @ApiProperty({ type: [SectionAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionAnswerDto)
  section_answers: SectionAnswerDto[];
}
