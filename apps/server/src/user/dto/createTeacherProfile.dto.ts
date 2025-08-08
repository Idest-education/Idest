import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Specialization } from 'src/common/enum/specialization.enum';

export class CreateTeacherProfileDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsNotEmpty()
  degree: string;

  @IsEnum(Specialization, { each: true })
  @IsNotEmpty()
  specialization: Specialization[];

  @IsString()
  @IsNotEmpty()
  bio: string;

}
