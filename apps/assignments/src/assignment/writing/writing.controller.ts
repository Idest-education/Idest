import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WritingService } from './writing.service';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { CreateWritingSubmissionDto } from './dto/create-writing-submission.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('writing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('writing')
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  @Post('assignments')
  @ApiOperation({ summary: 'Create writing assignment' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateAssignmentDto, @Req() req: any) {
    const data = await this.writingService.createAssignment({
      ...dto,
      created_by: req.user?.sub || req.user?.userId,
      slug: undefined as any,
    });
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List writing assignments' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll() {
    const data = await this.writingService.findAll();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get writing assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.writingService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Update writing assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    const data = await this.writingService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Delete writing assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.writingService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }

  @Post('submissions')
  @ApiOperation({ summary: 'Submit writing essay' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async submitEssay(@Body() dto: CreateWritingSubmissionDto) {
    const data = await this.writingService.submitEssay(dto);
    return { status: true, message: 'Submitted', data, statusCode: HttpStatus.CREATED };
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get writing submission' })
  @ApiResponse({ status: HttpStatus.OK })
  async getSubmission(@Param('id') id: string) {
    const data = await this.writingService.getSubmission(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }
}


