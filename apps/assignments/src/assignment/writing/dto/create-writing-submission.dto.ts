import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class CreateWritingSubmissionDto {
  @ApiProperty()
  @IsString()
  assignment_id: string;

  @ApiProperty()
  @IsString()
  user_id: string;

  @ApiProperty({ description: 'Map of writing task id to essay text' })
  @IsObject()
  content_by_task_id: Record<string, string>;
}
