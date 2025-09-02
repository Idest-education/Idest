import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('jwt')
  async getDevJwt(): Promise<{ access_token: string }> {
    return this.appService.getDevJwt();
  }
}
