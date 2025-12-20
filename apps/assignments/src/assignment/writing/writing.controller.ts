import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WritingService } from './writing.service';
import { CreateWritingAssignmentDto } from './dto/create-writing-assignment.dto';
import { UpdateWritingAssignmentDto } from './dto/update-writing-assignment.dto';
import { CreateWritingSubmissionDto } from './dto/create-writing-submission.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('writing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('writing')
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  @Post('assignments')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create writing assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateWritingAssignmentDto) {
    const data = await this.writingService.createAssignment(dto);
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List writing assignments' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(@Query() pagination: PaginationDto) {
    const data = await this.writingService.findAll(pagination);
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
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Update writing assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateWritingAssignmentDto) {
    const data = await this.writingService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete('assignments/:id')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Delete writing assignment (ADMIN/TEACHER only)' })
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

  @Get('submissions')
  @ApiOperation({ summary: 'Get all writing submissions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAllSubmissions() {
    const data = await this.writingService.getAllSubmissions();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/user/:userId')
  @ApiOperation({ summary: 'Get user writing submissions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getUserSubmissions(@Param('userId') userId: string) {
    const data = await this.writingService.getUserSubmissions(userId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/assignment/:assignmentId')
  @ApiOperation({ summary: 'Get all submissions for a writing assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAssignmentSubmissions(@Param('assignmentId') assignmentId: string) {
    const data = await this.writingService.getAssignmentSubmissions(assignmentId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get writing submission' })
  @ApiResponse({ status: HttpStatus.OK })
  async getSubmission(@Param('id') id: string) {
    const data = await this.writingService.getSubmission(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }
}


