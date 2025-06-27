import { IsBoolean, IsString } from "class-validator";
import { Role } from "src/common/enum/role.enum";

export class UpdateUserDto {
  @IsString()
  fullName?: string;
  @IsString()
  role?: Role;
  @IsString()
  avatar?: string;
  @IsBoolean()
  isActive?: boolean;
}
