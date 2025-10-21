import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SubquestionAnswerDto {
  @ApiProperty({
    description: 'Answer for the subquestion. Can be a string, number, boolean, or array',
    example: 'precipitation',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: { type: 'string' } },
      { type: 'array', items: { type: 'number' } },
    ],
  })
  @IsNotEmpty()
  answer: string | number | string[] | number[] | boolean;
}

export class QuestionAnswerDto {
  @ApiProperty({
    description: 'Question ID',
    example: 'q1',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Array of subquestion answers',
    type: [SubquestionAnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubquestionAnswerDto)
  subquestion_answers: SubquestionAnswerDto[];
}

export class SectionAnswerDto {
  @ApiProperty({
    description: 'Section ID',
    example: 'section-1',
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Array of question answers',
    type: [QuestionAnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  question_answers: QuestionAnswerDto[];
}

export class SubmitAssignmentDto {
  @ApiProperty({
    description: 'Assignment ID to submit answers for',
    example: '6e974c60-d6a2-4ecd-a358-51fed05f815e',
  })
  @IsString()
  @IsNotEmpty()
  assignment_id: string;

  @ApiProperty({
    description: 'User ID of the person submitting the assignment',
    example: 'student-user-id-123',
  })
  @IsString()
  @IsNotEmpty()
  submitted_by: string;

  @ApiProperty({
    description: 'Array of section answers',
    type: [SectionAnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionAnswerDto)
  section_answers: SectionAnswerDto[];
}
