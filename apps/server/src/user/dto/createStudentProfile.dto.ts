import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateStudentProfileDto {
  @IsNumber()
  @IsNotEmpty()
  target_score: number;

  @IsString()
  @IsNotEmpty()
  current_level: string;

}
