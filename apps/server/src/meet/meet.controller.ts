import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MeetService } from './meet.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { LiveKitTokenResponseDto } from './dto/livekit-token-response.dto';
import {
  MeetRecordingListResponseDto,
  MeetRecordingStartResponseDto,
  MeetRecordingStopResponseDto,
} from './dto/recording.dto';

@Controller('meet')
@ApiTags('Meet')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class MeetController {
  constructor(private readonly meetService: MeetService) {}

  @Get(':sessionId/livekit-token')
  @ApiOperation({
    summary: 'Issue LiveKit credentials for a meeting session',
    description:
      'Returns LiveKit Cloud connection details (URL, room name, JWT) so authorized users can join via the LiveKit client SDKs.',
  })
  @ApiOkResponse({
    description: 'LiveKit credentials issued successfully',
    type: LiveKitTokenResponseDto,
  })
  async getLiveKitToken(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<LiveKitTokenResponseDto> {
    await this.meetService.validateSession(sessionId);
    await this.meetService.validateUserSessionAccess(user.id, sessionId);
    const userDetails = await this.meetService.getUserDetails(user.id);

    const livekit = await this.meetService.prepareLiveKitCredentials(
      user.id,
      sessionId,
      userDetails,
    );

    return {
      sessionId,
      livekit,
    };
  }

  @Post(':sessionId/recordings/start')
  @ApiOperation({
    summary: 'Start recording a meeting session (LiveKit composite egress)',
  })
  @ApiOkResponse({
    description: 'Recording started',
    type: MeetRecordingStartResponseDto,
  })
  async startRecording(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<MeetRecordingStartResponseDto> {
    await this.meetService.validateSession(sessionId);
    await this.meetService.validateUserSessionAccess(user.id, sessionId);

    const egressId = await this.meetService.startRecording(user.id, sessionId);
    return { sessionId, egressId };
  }

  @Post(':sessionId/recordings/stop')
  @ApiOperation({
    summary: 'Stop recording a meeting session',
  })
  @ApiOkResponse({
    description: 'Recording stop requested',
    type: MeetRecordingStopResponseDto,
  })
  async stopRecording(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<MeetRecordingStopResponseDto> {
    await this.meetService.validateSession(sessionId);
    await this.meetService.validateUserSessionAccess(user.id, sessionId);

    await this.meetService.stopRecording(user.id, sessionId);
    return { sessionId, stopped: true };
  }

  @Get(':sessionId/recordings')
  @ApiOperation({
    summary: 'List recordings for a meeting session',
  })
  @ApiOkResponse({
    description: 'Recording list for the session',
    type: MeetRecordingListResponseDto,
  })
  async listRecordings(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<MeetRecordingListResponseDto> {
    await this.meetService.validateSession(sessionId);
    await this.meetService.validateUserSessionAccess(user.id, sessionId);

    const items = await this.meetService.listRecordings(sessionId);

    return { sessionId, items };
  }

  @Get('recordings/:recordingId/url')
  @ApiOperation({
    summary: 'Get a playback URL for a recording (may be null if storage is private)',
  })
  @ApiOkResponse({
    description: 'Playback URL lookup',
  })
  async getRecordingUrl(
    @Param('recordingId') recordingId: string,
    @CurrentUser() user: userPayload,
  ): Promise<{ recordingId: string; url: string | null; location: string | null }> {
    const { sessionId, url, location } =
      await this.meetService.getRecordingUrl(recordingId);
    await this.meetService.validateSession(sessionId);
    await this.meetService.validateUserSessionAccess(user.id, sessionId);
    return { recordingId, url, location };
  }
}
