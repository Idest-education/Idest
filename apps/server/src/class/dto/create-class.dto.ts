import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsBoolean()
  is_group: boolean;

  @IsObject()
  @IsOptional()
  schedule?: any; // JSON object for class schedule

  @IsString()
  @IsOptional()
  invite_code?: string; // Auto-generated if not provided
}
