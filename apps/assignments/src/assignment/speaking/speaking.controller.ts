import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SpeakingService } from './speaking.service';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { CreateSpeakingResponseDto } from './dto/create-speaking-response.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('speaking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('speaking')
export class SpeakingController {
  constructor(private readonly speakingService: SpeakingService) {}

  @Post('assignments')
  @ApiOperation({ summary: 'Create speaking assignment' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateAssignmentDto, @Req() req: any) {
    const data = await this.speakingService.createAssignment({
      ...dto,
      created_by: req.user?.sub || req.user?.userId,
      slug: undefined as any,
    });
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List speaking assignments' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll() {
    const data = await this.speakingService.findAll();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.speakingService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Update speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    const data = await this.speakingService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete speaking assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.speakingService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }

  @Post('responses')
  @ApiOperation({ summary: 'Submit speaking response' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async submitResponse(@Body() dto: CreateSpeakingResponseDto) {
    const data = await this.speakingService.submitResponse(dto);
    return { status: true, message: 'Submitted', data, statusCode: HttpStatus.CREATED };
  }

  @Get('responses/:id')
  @ApiOperation({ summary: 'Get speaking response' })
  @ApiResponse({ status: HttpStatus.OK })
  async getResponse(@Param('id') id: string) {
    const data = await this.speakingService.getResponse(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }
}


