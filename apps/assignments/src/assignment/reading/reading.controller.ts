import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ReadingService } from './reading.service';
import { CreateAssignmentV2Dto } from '../dto/v2/create-assignment-v2.dto';
import { UpdateAssignmentV2Dto } from '../dto/v2/update-assignment-v2.dto';
import { SubmitAssignmentV2Dto } from '../dto/v2/submit-assignment-v2.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('reading')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reading')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}


  @Post('assignments')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create reading assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateAssignmentV2Dto, @Req() req: any) {
    const data = await this.readingService.createAssignment({
      ...dto,
      created_by: (dto as any).created_by || req.user?.sub || req.user?.userId,
      slug: undefined as any,
    });
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List reading assignments' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(@Query() pagination: PaginationDto) {
    const data = await this.readingService.findAll(pagination);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }
  @Get('submissions')
  @ApiOperation({ summary: 'Get all reading submissions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAllSubmissions() {
    const data = await this.readingService.getAllSubmissions();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get reading assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.readingService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch('assignments/:id')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Update reading assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentV2Dto) {
    const data = await this.readingService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete('assignments/:id')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Delete reading assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.readingService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }

  @Post('submissions')
  @ApiOperation({ 
    summary: 'Submit and grade reading assignment',
    description: 'Submit answers for a reading assignment and receive immediate grading with a score from 0-9 (rounded to .0 or .5)'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Assignment graded and saved successfully' })
  async submit(@Body() dto: SubmitAssignmentV2Dto, @Req() req: any) {
    const data = await this.readingService.gradeSubmission({
      ...dto,
      submitted_by: dto.submitted_by || req.user?.sub || req.user?.userId,
    });
    return { status: true, message: 'Graded', data, statusCode: HttpStatus.OK };
  }


  @Get('submissions/user/:userId')
  @ApiOperation({ summary: 'Get user reading submissions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getUserSubmissions(@Param('userId') userId: string) {
    const data = await this.readingService.getUserSubmissions(userId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/assignment/:assignmentId')
  @ApiOperation({ summary: 'Get all submissions for a reading assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAssignmentSubmissions(@Param('assignmentId') assignmentId: string) {
    const data = await this.readingService.getAssignmentSubmissions(assignmentId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get reading submission' })
  @ApiResponse({ status: HttpStatus.OK })
  async getSubmission(@Param('id') id: string) {
    const data = await this.readingService.getSubmission(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  
}


