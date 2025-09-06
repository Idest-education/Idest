import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddClassMemberDto {
  @ApiProperty({
    description: 'ID of the student to add to the class',
    example: 'student-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  student_id: string;

  @ApiPropertyOptional({
    description: 'Status of the student in the class',
    example: 'active',
    default: 'active',
    enum: ['active', 'inactive', 'pending'],
  })
  @IsString()
  @IsOptional()
  status?: string = 'active';
}

export class AddClassTeacherDto {
  @ApiProperty({
    description: 'ID of the teacher to add to the class',
    example: 'teacher-uuid-here',
  })
  @IsString()
  @IsNotEmpty()
  teacher_id: string;

  @ApiPropertyOptional({
    description: 'Role of the teacher in the class',
    example: 'TEACHER',
    default: 'TEACHER',
    enum: ['TEACHER', 'ASSISTANT'],
  })
  @IsString()
  @IsOptional()
  role?: string = 'TEACHER';
}

export class JoinClassDto {
  @ApiProperty({
    description: 'Invite code for the class to join',
    example: 'IELTS2025',
  })
  @IsString()
  @IsNotEmpty()
  invite_code: string;
}
