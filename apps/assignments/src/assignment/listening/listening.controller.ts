import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ListeningService } from './listening.service';
import { CreateAssignmentV2Dto } from '../dto/v2/create-assignment-v2.dto';
import { UpdateAssignmentV2Dto } from '../dto/v2/update-assignment-v2.dto';
import { SubmitAssignmentV2Dto } from '../dto/v2/submit-assignment-v2.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { RolesGuard } from '../../guards/role.guard';
import { Roles } from '../../decorators/role.decorator';
import { PaginationDto } from '../dto/pagination.dto';

@ApiTags('listening')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('listening')
export class ListeningController {
  constructor(private readonly listeningService: ListeningService) {}

  @Post('assignments')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Create listening assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateAssignmentV2Dto, @Req() req: any) {
    const data = await this.listeningService.createAssignment({
      ...dto,
      created_by: req.user?.sub || req.user?.userId,
      slug: undefined as any,
    });
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get('assignments')
  @ApiOperation({ summary: 'List listening assignments' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll(@Query() pagination: PaginationDto) {
    const data = await this.listeningService.findAll(pagination);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Get all listening submissions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAllSubmissions() {
    const data = await this.listeningService.getAllSubmissions();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get listening assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.listeningService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch('assignments/:id')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Update listening assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentV2Dto) {
    const data = await this.listeningService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete('assignments/:id')
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({ summary: 'Delete listening assignment (ADMIN/TEACHER only)' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.listeningService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }

  @Post('submissions')
  @ApiOperation({ 
    summary: 'Submit and grade listening assignment',
    description: 'Submit answers for a listening assignment and receive immediate grading with a score from 0-9 (rounded to .0 or .5)'
  })
  @ApiResponse({ 
    status: HttpStatus.OK,
    description: 'Assignment graded and saved successfully',
    })
  async submit(@Body() dto: SubmitAssignmentV2Dto, @Req() req: any) {
    const data = await this.listeningService.gradeSubmission({
      ...dto,
      submitted_by: dto.submitted_by || req.user?.sub || req.user?.userId,
    });
    return { status: true, message: 'Graded', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/user/:userId')
  @ApiOperation({ summary: 'Get user listening submissions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getUserSubmissions(@Param('userId') userId: string) {
    const data = await this.listeningService.getUserSubmissions(userId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/assignment/:assignmentId')
  @ApiOperation({ summary: 'Get all submissions for a listening assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async getAssignmentSubmissions(@Param('assignmentId') assignmentId: string) {
    const data = await this.listeningService.getAssignmentSubmissions(assignmentId);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Get listening submission' })
  @ApiResponse({ status: HttpStatus.OK })
  async getSubmission(@Param('id') id: string) {
    const data = await this.listeningService.getSubmission(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }
}


