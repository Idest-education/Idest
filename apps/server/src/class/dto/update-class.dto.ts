import { IsOptional, IsString, IsObject, IsBoolean } from 'class-validator';

export class UpdateClassDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_group?: boolean;

  @IsObject()
  @IsOptional()
  schedule?: any;
}
