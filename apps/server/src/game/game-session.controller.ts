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
}
