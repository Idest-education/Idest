import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { GameSessionService } from './game-session.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { ExtendTimerDto } from './dto/extend-timer.dto';
import { HideWordDto } from './dto/hide-word.dto';

class StartSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

@Controller('game-sessions')
@ApiTags('Game Sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class GameSessionController {
  constructor(private readonly service: GameSessionService) {}

  @Post()
  @ApiOperation({ summary: 'Start a game session in a meeting' })
  start(@CurrentUser() user: userPayload, @Body() dto: StartSessionDto) {
    return this.service.startSession(dto.templateId, dto.sessionId, user.id);
  }

  @Post(':id/next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance to the next question or end the game' })
  next(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.nextQuestion(id, user.id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an answer for the current question' })
  submit(
    @CurrentUser() user: userPayload,
    @Param('id') id: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.service.submitAnswer(id, user.id, dto.answer);
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Get final leaderboard (only after game ends)' })
  leaderboard(@Param('id') id: string) {
    return this.service.getLeaderboard(id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active game session for a meeting' })
  @ApiQuery({ name: 'sessionId', required: true })
  getActive(@Query('sessionId') sessionId: string) {
    return this.service.getActiveSession(sessionId);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the current game round' })
  pause(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.pauseSession(id, user.id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused game round' })
  resume(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.resumeSession(id, user.id);
  }

  @Post(':id/extend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extend the current question timer' })
  extend(
    @CurrentUser() user: userPayload,
    @Param('id') id: string,
    @Body() dto: ExtendTimerDto,
  ) {
    return this.service.extendTimer(id, user.id, dto.extraSeconds);
  }

  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip the current question (0 pts for all)' })
  skip(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.skipQuestion(id, user.id);
  }

  @Post(':id/reveal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually reveal the answer before timer ends' })
  reveal(@CurrentUser() user: userPayload, @Param('id') id: string) {
    return this.service.revealAnswer(id, user.id);
  }

  @Post(':id/hide-word')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide a word from the word cloud' })
  hideWord(
    @CurrentUser() user: userPayload,
    @Param('id') id: string,
    @Body() dto: HideWordDto,
  ) {
    return this.service.hideWord(id, user.id, dto.word);
  }
}
