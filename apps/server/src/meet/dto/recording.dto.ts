import { ApiProperty } from '@nestjs/swagger';

export class MeetRecordingStartResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty({
    description: 'LiveKit egressId for the active recording',
  })
  egressId: string;
}

export class MeetRecordingStopResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty({ default: true })
  stopped: boolean;
}

export class MeetRecordingListItemDto {
  @ApiProperty({ nullable: true, description: 'Recording row id (null for legacy single recording_url)' })
  recordingId: string | null;

  @ApiProperty({ nullable: true })
  egressId: string | null;

  @ApiProperty({ nullable: true })
  url: string | null;

  @ApiProperty({ nullable: true })
  startedAt: string | null;

  @ApiProperty({ nullable: true })
  stoppedAt: string | null;
}

export class MeetRecordingListResponseDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty({ type: [MeetRecordingListItemDto] })
  items: MeetRecordingListItemDto[];
}


