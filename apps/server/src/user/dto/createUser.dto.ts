import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from 'src/common/enum/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  role: Role;

  @IsString()
  @IsOptional()
  avatar?: string;
}
