import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/role.guard';
import { Roles } from 'src/common/decorator/role.decorator';
import { Role } from 'src/common/enum/role.enum';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateAssignmentDto } from 'src/assignment/dto/create-assignment.dto';
import { UpdateAssignmentDto } from 'src/assignment/dto/update-assignment.dto';
import { AssignmentResponseDto } from 'src/assignment/dto/assignment-response.dto';
import { Public } from 'src/common/decorator/public.decorator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiUnprocessableEntityResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@Controller('assignment')
@ApiTags('Assignment')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Create assignment' })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiOkResponse({
    description: 'Assignment created',
    type: AssignmentResponseDto,
  })
  @ApiForbiddenResponse({ description: 'No permission' })
  async createAssignment(
    @CurrentUser() user: userPayload,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentService.createAssignment(user, dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update assignment' })
  @ApiParam({ name: 'id', description: 'Assignment ID' })
  @ApiBody({ type: UpdateAssignmentDto })
  @ApiOkResponse({
    description: 'Assignment updated',
    type: AssignmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  async updateAssignment(
    @Param('id') id: string,
    @CurrentUser() user: userPayload,
    @Body() dto: UpdateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentService.updateAssignment(id, user, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete assignment' })
  @ApiParam({ name: 'id', description: 'Assignment ID' })
  @ApiOkResponse({ description: 'Assignment deleted' })
  async deleteAssignment(
    @Param('id') id: string,
    @CurrentUser() user: userPayload,
  ): Promise<void> {
    return this.assignmentService.deleteAssignment(id, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get assignments' })
  @ApiQuery({ name: 'class_id', required: false })
  @ApiQuery({ name: 'creator_id', required: false })
  @ApiQuery({ name: 'is_public', required: false, type: Boolean })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({
    description: 'Assignments list',
    type: [AssignmentResponseDto],
  })
  async getAssignments(
    @Query('class_id') class_id?: string,
    @Query('creator_id') creator_id?: string,
    @Query('is_public') is_public?: string,
    @Query('q') q?: string,
    @CurrentUser() user?: userPayload,
  ): Promise<AssignmentResponseDto[]> {
    const isPublicBool =
      is_public === undefined ? undefined : is_public === 'true';
    return this.assignmentService.getAssignments({
      user,
      class_id,
      creator_id,
      is_public: isPublicBool,
      q,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiParam({ name: 'id', description: 'Assignment ID' })
  @ApiOkResponse({ description: 'Assignment', type: AssignmentResponseDto })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  async getAssignmentById(
    @Param('id') id: string,
    @CurrentUser() user?: userPayload,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentService.getAssignmentById(id, user);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get assignment by slug' })
  @ApiParam({ name: 'slug', description: 'Assignment slug' })
  @ApiOkResponse({ description: 'Assignment', type: AssignmentResponseDto })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  async getAssignmentBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: userPayload,
  ): Promise<AssignmentResponseDto> {
    return this.assignmentService.getAssignmentBySlug(slug, user);
  }
}
