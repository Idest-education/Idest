import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  IsObject,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  class_id: string;

  @IsDateString()
  @IsNotEmpty()
  start_time: string; // ISO date string

  @IsDateString()
  @IsOptional()
  end_time?: string; // ISO date string

  @IsBoolean()
  @IsOptional()
  is_recorded?: boolean = false;

  @IsObject()
  @IsOptional()
  metadata?: any; // Additional session metadata
}
