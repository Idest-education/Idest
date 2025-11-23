import { Controller, Get, Delete, Param, UseGuards, Query } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@Controller('assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Get()
  findAll() {
    return this.assignmentService.findAll();
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


