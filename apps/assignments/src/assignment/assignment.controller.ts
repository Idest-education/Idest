import { Controller, Get, Delete, Param, UseGuards, Query, Req } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaginationDto } from './dto/pagination.dto';

@Controller('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based) for each skill' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page for each skill' })
  findAll(@Query() pagination?: PaginationDto) {
    return this.assignmentService.findAll(pagination);
  }

  @Get('submissions/me')
  @ApiOperation({ summary: 'Get my submissions (paginated) across skills' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({
    name: 'skill',
    required: false,
    description: 'Optional skill filter',
    enum: ['reading', 'listening', 'writing', 'speaking'],
  })
  async getMySubmissions(
    @Req() req: any,
    @Query() pagination: PaginationDto,
    @Query('skill') skill?: 'reading' | 'listening' | 'writing' | 'speaking',
  ) {
    const userId = req.user?.sub || req.user?.userId;
    return this.assignmentService.getMySubmissions(userId, pagination, skill);
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Get all submissions across all skills' })
  getAllSubmissions() {
    return this.assignmentService.getAllSubmissions();
  }

  @Get('search/assignments')
  @ApiOperation({ summary: 'Search assignments by name' })
  @ApiQuery({ name: 'name', required: true, description: 'Assignment name to search for' })
  searchAssignments(@Query('name') name: string) {
    return this.assignmentService.searchAssignmentsByName(name);
  }

  @Get('search/submissions')
  @ApiOperation({ summary: 'Search submissions by assignment name' })
  @ApiQuery({ name: 'name', required: true, description: 'Assignment name to search submissions for' })
  searchSubmissions(@Query('name') name: string) {
    return this.assignmentService.searchSubmissionsByName(name);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignmentService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assignmentService.remove(id);
  }
}


