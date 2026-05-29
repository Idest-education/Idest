import { Controller, Get, Query, UseGuards, Req, BadRequestException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('me/timeline')
  @ApiOperation({ summary: 'Get student progress timeline' })
  @ApiQuery({ name: 'skill', required: false, enum: ['reading', 'listening', 'writing', 'speaking', 'overall'] })
  @ApiQuery({ name: 'window', required: false, enum: ['7d', '30d', '90d', 'all'] })
  async getTimeline(
    @Req() req: any,
    @Query('skill') skill?: 'reading' | 'listening' | 'writing' | 'speaking' | 'overall',
    @Query('window') window?: '7d' | '30d' | '90d' | 'all',
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const selectedSkill = skill || 'overall';
    const selectedWindow = window || '90d';

    if (!['reading', 'listening', 'writing', 'speaking', 'overall'].includes(selectedSkill)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Tham số skill không hợp lệ',
        errorCode: 'INVALID_QUERY_SKILL',
      });
    }

    if (!['7d', '30d', '90d', 'all'].includes(selectedWindow)) {
      throw new BadRequestException('Tham số window không hợp lệ');
    }

    return this.progressService.getTimeline(userId, selectedSkill, selectedWindow);
  }

  @Get('me/question-types')
  @ApiOperation({ summary: 'Get student question types accuracy statistics' })
  @ApiQuery({ name: 'skill', required: true, enum: ['reading', 'listening'] })
  @ApiQuery({ name: 'window', required: false, enum: ['7d', '30d', '90d', 'all'] })
  async getQuestionTypes(
    @Req() req: any,
    @Query('skill') skill: 'reading' | 'listening',
    @Query('window') window?: '7d' | '30d' | '90d' | 'all',
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const selectedWindow = window || '90d';

    if (!skill || !['reading', 'listening'].includes(skill)) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Tham số skill bắt buộc: reading | listening',
        errorCode: 'INVALID_QUERY_SKILL',
      });
    }

    if (!['7d', '30d', '90d', 'all'].includes(selectedWindow)) {
      throw new BadRequestException('Tham số window không hợp lệ');
    }

    return this.progressService.getQuestionTypes(userId, skill, selectedWindow);
  }

  @Get('me/writing-rubrics')
  @ApiOperation({ summary: 'Get student writing rubrics analysis' })
  @ApiQuery({ name: 'window', required: false, enum: ['7d', '30d', '90d', 'all'] })
  async getWritingRubrics(
    @Req() req: any,
    @Query('window') window?: '7d' | '30d' | '90d' | 'all',
  ) {
    const userId = req.user?.sub || req.user?.userId;
    const selectedWindow = window || '90d';

    if (!['7d', '30d', '90d', 'all'].includes(selectedWindow)) {
      throw new BadRequestException('Tham số window không hợp lệ');
    }

    return this.progressService.getWritingRubrics(userId, selectedWindow);
  }
}
