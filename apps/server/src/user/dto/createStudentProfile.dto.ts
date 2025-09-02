import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  IsIn,
} from 'class-validator';

export class CreateStudentProfileDto {
  @ApiProperty({
    description: 'The target IELTS score the student aims to achieve',
    example: 7.5,
    minimum: 0,
    maximum: 9,
    type: 'number',
  })
  @IsNumber({}, { message: 'Target score must be a number' })
  @IsNotEmpty({ message: 'Target score is required' })
  @Min(0, { message: 'Target score must be at least 0' })
  @Max(9, { message: 'Target score must be at most 9' })
  target_score: number;

  @ApiProperty({
    description: 'The current English proficiency level of the student',
    example: 'B2',
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    enumName: 'EnglishLevel',
  })
  @IsString({ message: 'Current level must be a string' })
  @IsNotEmpty({ message: 'Current level is required' })
  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], {
    message: 'Current level must be one of: A1, A2, B1, B2, C1, C2',
  })
  current_level: string;
}
