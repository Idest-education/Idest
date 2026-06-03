import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ description: 'Option label (A/B/C/D) for MCQ, or free text for FILL_BLANK' })
  @IsString()
  @IsNotEmpty()
  answer: string;
}
