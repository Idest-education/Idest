import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class AddClassMemberDto {
  @IsString()
  @IsNotEmpty()
  student_id: string;

  @IsString()
  @IsOptional()
  status?: string = 'active';
}

export class AddClassTeacherDto {
  @IsString()
  @IsNotEmpty()
  teacher_id: string;

  @IsString()
  @IsOptional()
  role?: string = 'TEACHER';
}

export class JoinClassDto {
  @IsString()
  @IsNotEmpty()
  invite_code: string;
}
