import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { AiService } from './ai.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { IsNotAvailableGuard } from 'src/common/guard/available.guard';
import { IsNotAvailable } from 'src/common/decorator/is-not-available.decorator';

@Controller('ai')
@IsNotAvailable()
@UseGuards(AuthGuard)
@UseGuards(IsNotAvailableGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-text')
  async generateText(@Body() body: { prompt: string }) {
    return this.aiService.generateText(body.prompt);
  }

  @Post('generate-text-with-context')
  async generateTextWithContext(@Body() body: { prompt: string }, @CurrentUser() user: User) {
    return this.aiService.generateTextWithContext(body.prompt, user);
  }
}
