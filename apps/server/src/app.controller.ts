import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: 'Check app health',
    description:
      "Check app health",
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('jwt')
  @ApiOperation({
    summary: 'Get dev JWT for testing',
    description:
      "No cred required",
  })
  async getDevJwt(): Promise<{ access_token: string }> {
    return this.appService.getDevJwt();
  }
}
