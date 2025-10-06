import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { FindAssignmentDto } from './dto/find-assignment.dto';
import { DeleteAssignmentDto } from './dto/delete-assignment.dto';

@Controller('assignment')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  create(@Body() createAssignmentDto: CreateAssignmentDto) {
    return this.assignmentService.create(createAssignmentDto);
  }

  @Get()
  findAll(@Query() findAssignmentDto: FindAssignmentDto) {
    return this.assignmentService.findAll(findAssignmentDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() createAssignmentDto: CreateAssignmentDto,
  ) {
    return this.assignmentService.update(id, createAssignmentDto);
  }

  @Delete()
  remove(@Query() deleteAssignmentDto: DeleteAssignmentDto) {
    return this.assignmentService.remove(deleteAssignmentDto);
  }
}
