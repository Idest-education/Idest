import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class StartScreenShareDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsOptional()
  @IsString()
  streamId?: string;
}

export class StopScreenShareDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class ToggleMediaDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsEnum(['audio', 'video'])
  type: 'audio' | 'video';

  @IsBoolean()
  isEnabled: boolean;
}

