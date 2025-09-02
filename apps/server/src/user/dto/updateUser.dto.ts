import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { Role } from 'src/common/enum/role.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'The full name of the user',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Full name must be a string' })
  @IsOptional()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName?: string;

  @ApiPropertyOptional({
    enum: Role,
    description: 'The role of the user in the system',
    example: Role.STUDENT,
    enumName: 'Role',
  })
  @IsEnum(Role, { message: 'Role must be a valid role value' })
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({
    description: "URL to the user's avatar image",
    example: 'https://example.com/avatar.png',
    format: 'url',
  })
  @IsString({ message: 'Avatar must be a string' })
  @IsUrl({}, { message: 'Avatar must be a valid URL' })
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Whether the user account is active',
    example: true,
  })
  @IsBoolean({ message: 'isActive must be a boolean value' })
  @IsOptional()
  isActive?: boolean;
}
