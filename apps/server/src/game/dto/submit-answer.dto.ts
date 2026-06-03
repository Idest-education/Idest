import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ description: 'Option label (A/B/C/D) for MCQ, or free text (max 100 chars) for FILL_BLANK' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  answer: string;
}
