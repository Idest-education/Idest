import {
  IsBoolean,
  IsOptional,
  IsDateString,
  IsString,
  IsObject,
} from 'class-validator';

export class UpdateSessionDto {
  @IsDateString()
  @IsOptional()
  start_time?: string;

  @IsDateString()
  @IsOptional()
  end_time?: string;

  @IsBoolean()
  @IsOptional()
  is_recorded?: boolean;

  @IsString()
  @IsOptional()
  recording_url?: string;

  @IsObject()
  @IsOptional()
  whiteboard_data?: any;

  @IsObject()
  @IsOptional()
  metadata?: any;
}
