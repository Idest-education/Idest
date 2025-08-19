import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BulkStudentIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  student_ids: string[];
}


