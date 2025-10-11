import { ApiProperty } from '@nestjs/swagger';

export class SubquestionResultDto {
  @ApiProperty({
    description: 'Whether the subquestion answer was correct',
    example: true,
  })
  correct: boolean;

  @ApiProperty({
    description: 'The answer submitted by the student',
    example: 'precipitation',
  })
  submitted_answer: any;

  @ApiProperty({
    description: 'The correct answer',
    example: 'precipitation',
  })
  correct_answer: any;
}

export class QuestionResultDto {
  @ApiProperty({
    description: 'Question ID',
    example: 'q1',
  })
  question_id: string;

  @ApiProperty({
    description: 'Results for each subquestion',
    type: [SubquestionResultDto],
  })
  subquestions: SubquestionResultDto[];
}

export class SectionResultDto {
  @ApiProperty({
    description: 'Section ID',
    example: 'section-1',
  })
  section_id: string;

  @ApiProperty({
    description: 'Section title',
    example: 'Passage 1: The History of Coffee',
  })
  section_title: string;

  @ApiProperty({
    description: 'Results for each question in the section',
    type: [QuestionResultDto],
  })
  questions: QuestionResultDto[];
}

export class GradingResultDto {
  @ApiProperty({
    description: 'Final score on a scale of 0-9, rounded to nearest 0.5',
    example: 8.0,
    minimum: 0,
    maximum: 9,
  })
  score: number;

  @ApiProperty({
    description: 'Total number of subquestions',
    example: 10,
  })
  total_questions: number;

  @ApiProperty({
    description: 'Number of correct answers',
    example: 9,
  })
  correct_answers: number;

  @ApiProperty({
    description: 'Number of incorrect answers',
    example: 1,
  })
  incorrect_answers: number;

  @ApiProperty({
    description: 'Percentage of correct answers',
    example: 90.0,
  })
  percentage: number;

  @ApiProperty({
    description: 'Detailed results by section, question, and subquestion',
    type: [SectionResultDto],
  })
  details: SectionResultDto[];
}

