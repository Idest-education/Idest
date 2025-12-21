import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

/**
 * V2 submission model:
 * - answers is a dictionary keyed by questionId.
 * - for each questionId, payload shape depends on question.type.
 *
 * Examples:
 * - gap_fill_template: { blanks: { \"1\": \"bonding\", \"2\": \"danger\" } }
 * - matching: { map: { \"leftA\": \"right2\", \"leftB\": \"right1\" } }
 * - multiple_choice_single: { choice: \"optA\" }
 * - true_false_not_given: { choice: \"TRUE\" }
 */

export class QuestionAnswerV2Dto {
  @ApiProperty({ description: 'Question ID' })
  @IsString()
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({ description: 'Type-specific answer payload' })
  @IsObject()
  answer: any;
}

export class SectionAnswerV2Dto {
  @ApiProperty({ description: 'Section ID' })
  @IsString()
  @IsNotEmpty()
  section_id: string;

  @ApiProperty({ type: [QuestionAnswerV2Dto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerV2Dto)
  answers: QuestionAnswerV2Dto[];
}

export class SubmitAssignmentV2Dto {
  @ApiProperty({ description: 'Assignment ID' })
  @IsString()
  @IsNotEmpty()
  assignment_id: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  submitted_by: string;

  @ApiProperty({ type: [SectionAnswerV2Dto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionAnswerV2Dto)
  section_answers: SectionAnswerV2Dto[];
}


