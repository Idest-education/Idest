import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Role } from 'src/common/enum/role.enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'The full name of the user',
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
    enum: Role,
    description: 'The role of the user in the system',
    example: Role.STUDENT,
    enumName: 'Role',
  })
  @IsEnum(Role, { message: 'Role must be a valid role value' })
  @IsNotEmpty({ message: 'Role is required' })
  role: Role;

  @ApiPropertyOptional({
    description: "URL to the user's avatar image",
    example: 'https://example.com/avatar.png',
    format: 'url',
  })
  @IsString({ message: 'Avatar must be a string' })
  @IsUrl({}, { message: 'Avatar must be a valid URL' })
  @IsOptional()
  avatar?: string;
}
