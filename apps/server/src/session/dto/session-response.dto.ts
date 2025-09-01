import { IsString, IsBoolean, ValidateNested, IsDate, IsOptional, IsJSON } from 'class-validator';
import { Type } from 'class-transformer';
import { JsonValue } from '@prisma/client/runtime/library';

export class ClassInfoDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

}

export class HostInfoDto {
  @IsString()
  id: string;

  @IsString()
  full_name: string;

  @IsString()
  email: string;
}

export class SessionResponseDto {
  @IsString()
  id: string;

  @IsString()
  class_id: string;

  @IsString()
  host_id: string;

  @IsDate()
  start_time: Date;

  @IsDate()
  @IsOptional()
  end_time: Date | null;

  @IsBoolean()
  is_recorded: boolean;

  @IsString()
  @IsOptional()
  recording_url: string | null;

  @IsJSON()
  @IsOptional()
  whiteboard_data: JsonValue | null;

  @IsJSON()
  @IsOptional()
  metadata: JsonValue | null;

  @ValidateNested()
  @Type(() => ClassInfoDto)
  class: ClassInfoDto;

  @ValidateNested()
  @Type(() => HostInfoDto)
  host: HostInfoDto;
}
