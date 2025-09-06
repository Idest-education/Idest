import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkStudentIdsDto {
  @ApiProperty({
    description: 'Array of student IDs to add or remove from the class',
    example: ['student-uuid-1', 'student-uuid-2', 'student-uuid-3'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  student_ids: string[];
}
