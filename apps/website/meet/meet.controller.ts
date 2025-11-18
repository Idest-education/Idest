import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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
}
