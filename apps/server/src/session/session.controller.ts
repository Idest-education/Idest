import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { PaginationDto, PaginatedResponse } from './dto/pagination.dto';
import {
  AttendanceRecordDto,
  SessionAttendanceSummaryDto,
} from './dto/attendance.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
  ApiUnprocessableEntityResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@Controller('session')
@ApiTags('Session')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create session',
    description:
      'Creates a new learning session for a specific class. Only teachers/admins can create sessions.',
  })
  @ApiBody({ type: CreateSessionDto })
  @ApiOkResponse({
    description: 'Session successfully created',
    type: SessionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only teachers/admins can create sessions',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to create session - validation errors',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createSession(
    @CurrentUser() user: userPayload,
    @Body() dto: CreateSessionDto,
  ): Promise<SessionResponseDto> {
    return this.sessionService.createSession(user, dto);
  }

  @Get('')
  @ApiOperation({
    summary: 'Get all sessions',
    description:
      'Retrieves all sessions across all classes with pagination. Only teachers/admins can access this endpoint.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved all sessions (paginated)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/SessionResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Access denied - only teachers/admins can access all sessions',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getAllSessions(
    @CurrentUser() user: userPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    return this.sessionService.getAllSessions(user.id, pagination);
  }

  @Get('user')
  @ApiOperation({
    summary: 'Get all user sessions',
    description:
      'Retrieves all sessions for the authenticated user including hosted, attended, and upcoming sessions with pagination.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved all user sessions (paginated)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/SessionResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getAllUserSessions(
    @CurrentUser() user: userPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    return this.sessionService.getAllUserSessions(user.id, pagination);
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming sessions',
    description:
      'Retrieves all upcoming sessions for the authenticated user (both hosted and attended).',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved upcoming sessions',
    type: [SessionResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getUserUpcomingSessions(
    @CurrentUser() user: userPayload,
  ): Promise<SessionResponseDto[]> {
    return this.sessionService.getUserUpcomingSessions(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get session by ID',
    description:
      'Retrieves detailed information about a specific session including whiteboard data and metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved session details',
    type: SessionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Session not found or access denied' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getSessionById(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<SessionResponseDto> {
    return this.sessionService.getSessionById(sessionId, user.id);
  }

  /**
   * @deprecated This endpoint is deprecated and will be removed in a future version.
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update session (DEPRECATED)',
    description:
      'Updates session details such as time, recording settings, whiteboard data, and metadata. Only session hosts can update sessions.\n\n** DEPRECATED**: This endpoint is deprecated and will be removed in a future version. Please use alternative endpoints instead.',
    deprecated: true,
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiBody({ type: UpdateSessionDto })
  @ApiOkResponse({
    description: 'Session successfully updated',
    type: SessionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only session host can update',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to update session - validation errors',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async updateSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: UpdateSessionDto,
  ): Promise<void> {
    // return this.sessionService.updateSession(sessionId, user.id, dto);
    return;
  }

  @Put(':id/end')
  @ApiOperation({
    summary: 'End session',
    description:
      'Ends an active session by setting the end time to the current timestamp. Only session hosts can end sessions.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiOkResponse({
    description: 'Session successfully ended',
    type: SessionResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only session host can end session',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Session is already ended or cannot be ended',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async endSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<SessionResponseDto> {
    return this.sessionService.endSession(sessionId, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete session',
    description:
      'Permanently deletes a session. Only session hosts or admins can delete sessions.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiOkResponse({
    description: 'Session successfully deleted',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only session host or admin can delete',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Cannot delete active session - end session first',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async deleteSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<boolean> {
    return this.sessionService.deleteSession(sessionId, user.id);
  }

  @Get('class/:classId')
  @ApiOperation({
    summary: 'Get class sessions',
    description:
      'Retrieves all sessions for a specific class with pagination. Users must be enrolled in or teaching the class to access this endpoint.',
  })
  @ApiParam({
    name: 'classId',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved class sessions (paginated)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/SessionResponseDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Class not found or access denied' })
  @ApiForbiddenResponse({
    description: 'Access denied - user not enrolled in or teaching this class',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getClassSessions(
    @Param('classId') classId: string,
    @CurrentUser() user: userPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    return this.sessionService.getClassSessions(classId, user.id, pagination);
  }

  @Post(':id/attendance')
  @ApiOperation({
    summary: 'Record attendance',
    description:
      'Records user attendance when joining a session. Automatically called when user joins via meet module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiOkResponse({
    description: 'Attendance successfully recorded',
    type: AttendanceRecordDto,
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({ description: 'Access denied to this session' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async recordAttendance(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<AttendanceRecordDto> {
    return this.sessionService.recordAttendance(sessionId, user.id);
  }

  @Put(':id/attendance/leave')
  @ApiOperation({
    summary: 'Record leave',
    description:
      'Records when a user leaves a session. Automatically called when user leaves via meet module.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiOkResponse({ description: 'Leave successfully recorded' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async recordLeave(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<{ success: boolean }> {
    await this.sessionService.recordLeave(sessionId, user.id);
    return { success: true };
  }

  @Get(':id/attendance')
  @ApiOperation({
    summary: 'Get session attendance',
    description:
      'Retrieves attendance summary for a session including all attendees and statistics.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID',
    example: 'session-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved attendance summary',
    type: SessionAttendanceSummaryDto,
  })
  @ApiNotFoundResponse({ description: 'Session not found' })
  @ApiForbiddenResponse({ description: 'Access denied to this session' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getSessionAttendance(
    @Param('id') sessionId: string,
    @CurrentUser() user: userPayload,
  ): Promise<SessionAttendanceSummaryDto> {
    return this.sessionService.getSessionAttendance(sessionId, user.id);
  }

  @Get('user/attendance')
  @ApiOperation({
    summary: 'Get user attendance history',
    description:
      'Retrieves attendance history for the authenticated user across all sessions with pagination.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved user attendance history (paginated)',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/AttendanceRecordDto' },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getUserAttendance(
    @CurrentUser() user: userPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<AttendanceRecordDto>> {
    return this.sessionService.getUserAttendance(user.id, pagination);
  }
}
