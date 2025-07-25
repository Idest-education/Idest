import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { User } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Controller('session')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Create a new session
   */
  @Post()
  async createSession(
    @User() user: userPayload,
    @Body() dto: CreateSessionDto,
  ): Promise<ResponseDto> {
    return this.sessionService.createSession(user, dto);
  }

  /**
   * Get user's upcoming sessions
   */
  @Get('upcoming')
  async getUserUpcomingSessions(
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.sessionService.getUserUpcomingSessions(user.id);
  }

  /**
   * Get session details by ID
   */
  @Get(':id')
  async getSessionById(
    @Param('id') sessionId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.sessionService.getSessionById(sessionId, user.id);
  }

  /**
   * Update session details
   */
  @Put(':id')
  async updateSession(
    @Param('id') sessionId: string,
    @User() user: userPayload,
    @Body() dto: UpdateSessionDto,
  ): Promise<ResponseDto> {
    return this.sessionService.updateSession(sessionId, user.id, dto);
  }

  /**
   * End a session
   */
  @Put(':id/end')
  async endSession(
    @Param('id') sessionId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.sessionService.endSession(sessionId, user.id);
  }

  /**
   * Delete session
   */
  @Delete(':id')
  async deleteSession(
    @Param('id') sessionId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.sessionService.deleteSession(sessionId, user.id);
  }

  /**
   * Get all sessions for a specific class
   */
  @Get('class/:classId')
  async getClassSessions(
    @Param('classId') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.sessionService.getClassSessions(classId, user.id);
  }
}
