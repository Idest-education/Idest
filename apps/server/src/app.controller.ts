import { Controller, Get, Body, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiBody, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { SkipEnvelope } from './common/decorator/skip-envelope.decorator';

class JwtRequestDto {
  @ApiProperty({
    description: 'The secret password to get dev JWT',
    example: 'dev-password',
  })
  @IsString({ message: 'SecretPassword must be a string' })
  @IsNotEmpty({ message: 'SecretPassword is required' })
  SecretPassword: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: 'Check app health',
  })
  @Get()
  @SkipEnvelope()
  getHello(): string {
    return `Made by <a href="https://github.com/LuckiPhoenix" target="_blank">Lucki</a>
<a> Bây giờ là ${new Date().toLocaleString()}</a>
<a> Đang chạy trên ${process.env.NODE_ENV} environment</a>
<a> uptime: ${process.uptime()}</a>
    `;
  }

  @Post('jwt')
  @ApiOperation({
    summary: 'Get dev JWT for testing',
    description: 'No cred required',
  })
  @ApiBody({
    type: JwtRequestDto,
  })
  async getDevJwt(
    @Body() body: JwtRequestDto,
  ): Promise<{ access_token: string }> {
    return this.appService.getDevJwt(body.SecretPassword);
  }
}
