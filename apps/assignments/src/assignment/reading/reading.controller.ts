import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReadingService } from './reading.service';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { SubmitAssignmentDto } from '../dto/submit-assignment.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('reading')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reading/assignments')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Post()
  @ApiOperation({ summary: 'Create reading assignment' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateAssignmentDto, @Req() req: any) {
    const data = await this.readingService.createAssignment({
      ...dto,
      created_by: (dto as any).created_by || req.user?.sub || req.user?.userId,
      slug: undefined as any,
    });
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get()
  @ApiOperation({ summary: 'List reading assignments' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll() {
    const data = await this.readingService.findAll();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reading assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.readingService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update reading assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    const data = await this.readingService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete reading assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.readingService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }

  @Post('submit')
  @ApiOperation({ 
    summary: 'Submit and grade reading assignment',
    description: 'Submit answers for a reading assignment and receive immediate grading with a score from 0-9 (rounded to .0 or .5)'
  })
  async submit(@Body() dto: SubmitAssignmentDto) {
    const data = await this.readingService.gradeSubmission({
      ...dto,
      submitted_by: dto.submitted_by
    });
    return { status: true, message: 'Graded', data, statusCode: HttpStatus.OK };
  }
}


