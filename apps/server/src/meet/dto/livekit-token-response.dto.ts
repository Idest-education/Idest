import { ApiProperty } from '@nestjs/swagger';
import { LiveKitCredentials } from '../meet.service';

class LiveKitCredentialsDto implements LiveKitCredentials {
  @ApiProperty({ description: 'LiveKit server URL' })
  url: string;

  @ApiProperty({ description: 'LiveKit room name' })
  roomName: string;

  @ApiProperty({ description: 'JWT access token for joining the room' })
  accessToken: string;
}

export class LiveKitTokenResponseDto {
  @ApiProperty({ description: 'Session identifier associated with the room' })
  sessionId: string;

  @ApiProperty({
    description: 'LiveKit credentials payload',
    type: LiveKitCredentialsDto,
  })
  livekit: LiveKitCredentialsDto;
}
