import { IsNotEmpty, IsString } from 'class-validator';

export class KickParticipantDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class StopParticipantMediaDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @IsString()
  @IsNotEmpty()
  mediaType: 'audio' | 'video' | 'both';
}

export class StartRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class StopRecordingDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
