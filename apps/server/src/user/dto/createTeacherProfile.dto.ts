import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsUrl,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Specialization } from 'src/common/enum/specialization.enum';

export class CreateTeacherProfileDto {
  @ApiProperty({
    description: 'The full name of the teacher',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName: string;

  @ApiProperty({
    description: 'The email address of the teacher (used for invitation)',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiPropertyOptional({
    description: "URL to the teacher's avatar image",
    example: 'https://example.com/avatar.png',
    format: 'url',
  })
  @IsString({ message: 'Avatar must be a string' })
  @IsUrl({}, { message: 'Avatar must be a valid URL' })
  @IsOptional()
  avatar?: string;

  @ApiProperty({
    description: 'The highest educational degree of the teacher',
    example: 'Master of Arts in English Literature',
    minLength: 2,
    maxLength: 200,
  })
  @IsString({ message: 'Degree must be a string' })
  @IsNotEmpty({ message: 'Degree is required' })
  @MinLength(2, { message: 'Degree must be at least 2 characters long' })
  @MaxLength(200, { message: 'Degree must not exceed 200 characters' })
  degree: string;

  @ApiProperty({
    isArray: true,
    enum: Specialization,
    description: 'The IELTS skill areas the teacher specializes in',
    example: [
      Specialization.LISTENING,
      Specialization.READING,
      Specialization.WRITING,
      Specialization.SPEAKING,
    ],
    enumName: 'Specialization',
  })
  @IsArray({ message: 'Specialization must be an array' })
  @ArrayMinSize(1, { message: 'At least one specialization is required' })
  @IsEnum(Specialization, {
    each: true,
    message: 'Each specialization must be a valid specialization value',
  })
  @IsNotEmpty({ message: 'Specialization is required' })
  specialization: Specialization[];

  @ApiProperty({
    description:
      "A brief biography or description of the teacher's background and experience",
    example:
      'I am an experienced IELTS instructor with over 5 years of teaching experience, specializing in helping students achieve their target scores.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString({ message: 'Bio must be a string' })
  @IsNotEmpty({ message: 'Bio is required' })
  @MinLength(10, { message: 'Bio must be at least 10 characters long' })
  @MaxLength(1000, { message: 'Bio must not exceed 1000 characters' })
  bio: string;
}
