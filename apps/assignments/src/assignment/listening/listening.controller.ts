import { Controller, Get, Post, Patch, Delete, Param, Body, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ListeningService } from './listening.service';
import { CreateAssignmentDto } from '../dto/create-assignment.dto';
import { UpdateAssignmentDto } from '../dto/update-assignment.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@ApiTags('listening')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('listening/assignments')
export class ListeningController {
  constructor(private readonly listeningService: ListeningService) {}

  @Post()
  @ApiOperation({ summary: 'Create listening assignment' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async create(@Body() dto: CreateAssignmentDto, @Req() req: any) {
    const data = await this.listeningService.createAssignment({
      ...dto,
      created_by: req.user?.sub || req.user?.userId,
      slug: undefined as any,
    });
    return { status: true, message: 'Created', data, statusCode: HttpStatus.CREATED };
  }

  @Get()
  @ApiOperation({ summary: 'List listening assignments' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAll() {
    const data = await this.listeningService.findAll();
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get listening assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async findOne(@Param('id') id: string) {
    const data = await this.listeningService.findOne(id);
    return { status: true, message: 'Fetched', data, statusCode: HttpStatus.OK };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update listening assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    const data = await this.listeningService.update(id, dto);
    return { status: true, message: 'Updated', data, statusCode: HttpStatus.OK };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete listening assignment' })
  @ApiResponse({ status: HttpStatus.OK })
  async remove(@Param('id') id: string) {
    const data = await this.listeningService.remove(id);
    return { status: true, message: 'Deleted', data, statusCode: HttpStatus.OK };
  }
}


