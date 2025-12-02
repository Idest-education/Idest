import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ClassService } from './class.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { ResponseDto } from 'src/common/dto/response.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import {
  AddClassMemberDto,
  AddClassTeacherDto,
  JoinClassDto,
} from './dto/class-member.dto';
import { BulkStudentIdsDto } from './dto/bulk-members.dto';
import { RolesGuard } from 'src/common/guard/role.guard';
import { Roles } from 'src/common/decorator/role.decorator';
import { Role } from 'src/common/enum/role.enum';
import {
  ClassCountDto,
  ClassResponseDto,
  FullClassResponseDto,
  UserClassesResponseDto,
  UserSummaryDto,
  PaginatedClassResponseDto,
} from './dto/class-response.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
  ApiUnprocessableEntityResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@Controller('class')
@ApiTags('Class')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Create class',
    description:
      'Creates a new class. Only teachers and admins can create classes.',
  })
  @ApiBody({ type: CreateClassDto })
  @ApiOkResponse({
    description: 'Class successfully created',
    type: ClassResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to create class - validation errors',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createClass(
    @CurrentUser() user: userPayload,
    @Body() dto: CreateClassDto,
  ): Promise<ClassResponseDto> {
    console.log('createClass route called:', { user, dto });
    return this.classService.createClass(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user classes',
    description:
      'Retrieves all classes for the authenticated user (created, teaching, and enrolled).',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved user classes',
    type: UserClassesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getUserClasses(
    @CurrentUser() user: userPayload,
  ): Promise<UserClassesResponseDto> {
    console.log('getUserClasses route called:', { user });
    return this.classService.getUserClasses(user.id);
  }

  @Put(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Update class',
    description:
      'Updates class details including name, description, schedule, and group settings. Only class creators or admins can update classes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiBody({ type: UpdateClassDto })
  @ApiOkResponse({
    description: 'Class successfully updated',
    type: ClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only class creator or ADMIN can update',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to update class - validation errors',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async updateClass(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: UpdateClassDto,
  ): Promise<ClassResponseDto> {
    console.log('updateClass route called:', { classId, user, dto });
    return this.classService.updateClass(classId, user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Delete class',
    description:
      'Permanently deletes a class and all associated data. Only class creators or admins can delete classes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Class successfully deleted',
    schema: { type: 'string', example: 'Class deleted successfully' },
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only class creator or ADMIN can delete',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async deleteClass(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<void> {
    console.log('deleteClass route called:', { classId, user });
    return this.classService.deleteClass(classId, user.id);
  }

  @Post(':id/students')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Add student to class',
    description:
      'Adds a student to a class. Only teachers and admins can add students to classes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiBody({ type: AddClassMemberDto })
  @ApiOkResponse({
    description: 'Student successfully added to class',
    type: ClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class or student not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Student already enrolled or failed to add student',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async addStudent(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: AddClassMemberDto,
  ): Promise<ClassResponseDto> {
    console.log('addStudent route called:', { classId, user, dto });
    return this.classService.addStudent(classId, user.id, dto);
  }

  @Delete(':id/students/:studentId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Remove student from class',
    description:
      'Removes a student from a class. Only teachers and admins can remove students.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student ID to remove',
    example: 'student-uuid-here',
  })
  @ApiOkResponse({
    description: 'Student successfully removed from class',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'Class or student not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async removeStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: userPayload,
  ): Promise<boolean> {
    console.log('removeStudent route called:', { classId, studentId, user });
    return this.classService.removeStudent(classId, user.id, studentId);
  }

  @Post(':id/teachers')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Add teacher to class',
    description:
      'Adds a teacher to a class. Only teachers and admins can add teachers to classes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiBody({ type: AddClassTeacherDto })
  @ApiOkResponse({
    description: 'Teacher successfully added to class',
    type: ClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class or teacher not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Teacher already assigned, failed to add teacher or input is not a teacher',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async addTeacher(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: AddClassTeacherDto,
  ): Promise<ClassResponseDto> {
    console.log('addTeacher route called:', { classId, user, dto });
    return this.classService.addTeacher(classId, user.id, dto);
  }

  @Delete(':id/teachers/:teacherId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Remove teacher from class',
    description:
      'Removes a teacher from a class. Only teachers and admins can remove teachers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiParam({
    name: 'teacherId',
    description: 'Teacher ID to remove',
    example: 'teacher-uuid-here',
  })
  @ApiOkResponse({
    description: 'Teacher successfully removed from class',
    type: ClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class or teacher not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async removeTeacher(
    @Param('id') classId: string,
    @Param('teacherId') teacherId: string,
    @CurrentUser() user: userPayload,
  ): Promise<ClassResponseDto> {
    console.log('removeTeacher route called:', { classId, teacherId, user });
    return this.classService.removeTeacher(classId, user.id, teacherId);
  }

  @Post('join')
  @ApiOperation({
    summary: 'Join class with invite code',
    description:
      'Allows students to join a class using an invite code. The invite code must be valid and not expired.',
  })
  @ApiBody({ type: JoinClassDto })
  @ApiOkResponse({
    description: 'Successfully joined class',
    type: ClassResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Class not found or invalid invite code',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Already enrolled in class or invite code expired',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async joinClass(
    @CurrentUser() user: userPayload,
    @Body() dto: JoinClassDto,
  ): Promise<ClassResponseDto> {
    console.log('joinClass route called:', { user, dto });
    return this.classService.joinClass(user.id, dto.invite_code);
  }

  @Delete(':id/leave')
  @ApiOperation({
    summary: 'Leave class',
    description:
      'Allows users to leave a class they are enrolled in or teaching. Students and teachers can leave classes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully left class',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'Class not found or user not enrolled' })
  @ApiForbiddenResponse({
    description: 'Cannot leave class - only creator can leave as last teacher',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async leaveClass(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<boolean> {
    console.log('leaveClass route called:', { classId, user });
    return this.classService.leaveClass(classId, user.id);
  }

  @Get(':id/members')
  @ApiOperation({
    summary: 'Get class members',
    description:
      'Retrieves all students enrolled in a class. Only class members and teachers can view the member list.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved class members',
    type: [UserSummaryDto],
  })
  @ApiNotFoundResponse({ description: 'Class not found or access denied' })
  @ApiForbiddenResponse({
    description: 'Access denied - must be enrolled in or teaching the class',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getClassMembers(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<UserSummaryDto[]> {
    console.log('getClassMembers route called:', { classId, user });
    return this.classService.getClassMembers(classId, user.id);
  }

  @Get(':id/teachers')
  @ApiOperation({
    summary: 'Get class teachers',
    description:
      'Retrieves all teachers assigned to a class. Only class members can view the teacher list.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved class teachers',
    type: [UserSummaryDto],
  })
  @ApiNotFoundResponse({ description: 'Class not found or access denied' })
  @ApiForbiddenResponse({
    description: 'Access denied - must be enrolled in or teaching the class',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getClassTeachers(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<UserSummaryDto[]> {
    console.log('getClassTeachers route called:', { classId, user });
    return this.classService.getClassTeachers(classId, user.id);
  }

  @Get(':id/statistics')
  @ApiOperation({
    summary: 'Get class statistics',
    description:
      'Retrieves statistics about a class including member count, teacher count, and session count. Only class members can view statistics.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved class statistics',
    type: ClassCountDto,
  })
  @ApiNotFoundResponse({ description: 'Class not found or access denied' })
  @ApiForbiddenResponse({
    description: 'Access denied - must be enrolled in or teaching the class',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getClassStatistics(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<ClassCountDto> {
    console.log('getClassStatistics route called:', { classId, user });
    return this.classService.getClassStatistics(classId, user.id);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search classes',
    description:
      'Searches for classes by name or description. Returns classes the user has access to.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query string',
    example: 'IELTS preparation',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved search results',
    type: [ClassResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async searchClasses(
    @CurrentUser() user: userPayload,
    @Query('q') q?: string,
  ): Promise<ClassResponseDto[]> {
    console.log('searchClasses route called:', { user, q });
    return this.classService.searchClasses(user.id, q || '');
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get class by slug',
    description:
      'Retrieves a class by its URL-friendly slug. Only accessible to class members.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Class slug',
    example: 'ielts-preparation-advanced-level',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved class by slug',
    type: FullClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class not found or access denied' })
  @ApiForbiddenResponse({
    description: 'Access denied - must be enrolled in or teaching the class',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getClassBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: userPayload,
  ): Promise<FullClassResponseDto> {
    console.log('getClassBySlug route called:', { slug, user });
    return this.classService.getClassBySlug(slug, user.id);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all classes',
    description:
      'Retrieves all classes with pagination, filtering, and sorting options.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Items per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query string',
    example: 'IELTS preparation',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Field to sort by',
    example: 'updated_at',
    enum: ['name', 'created_at', 'updated_at'],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @ApiQuery({
    name: 'creatorId',
    required: false,
    description: 'Filter by creator ID',
    example: 'teacher-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved all classes',
    type: PaginatedClassResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Access denied - ADMIN role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getAllClasses(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('sortBy')
    sortBy: 'name' | 'created_at' | 'updated_at' = 'updated_at',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('creatorId') creatorId?: string,
  ): Promise<PaginatedClassResponseDto> {
    console.log('getAllClasses route called:', {
      page,
      pageSize,
      q,
      sortBy,
      sortOrder,
      creatorId,
    });
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const sizeNum = Math.min(
      Math.max(parseInt(pageSize as string, 10) || 20, 1),
      100,
    );
    return this.classService.getAllClasses({
      page: pageNum,
      pageSize: sizeNum,
      q,
      sortBy,
      sortOrder,
      creatorId,
    });
  }

  
  /**
   * @deprecated This endpoint is deprecated and will be removed in a future release.
   */
  @Get('public')
  @ApiOperation({
    summary: 'Get public classes',
    description:
      'Retrieves all public classes that are open for enrollment. No authentication required.',
    deprecated: true,
  })
  @ApiOkResponse({
    description: 'Successfully retrieved public classes',
    type: [ClassResponseDto],
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getPublicClasses(): Promise<string> {
    console.warn('DEPRECATED: getPublicClasses route called');
    return "unavailable";
  }

  @Put(':id/regenerate-code')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Regenerate invite code',
    description:
      'Generates a new invite code for the class. Only class creators or admins can regenerate codes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully regenerated invite code',
    schema: { type: 'string', example: 'NEWCODE2025' },
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description:
      'Access denied - only class creator or ADMIN can regenerate code',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async regenerateInviteCode(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<string> {
    console.log('regenerateInviteCode route called:', { classId, user });
    return this.classService.regenerateInviteCode(classId, user.id);
  }

  @Get('validate-code/:code')
  @ApiOperation({
    summary: 'Validate invite code',
    description:
      'Validates an invite code and returns class information if valid. No authentication required.',
  })
  @ApiParam({
    name: 'code',
    description: 'Invite code to validate',
    example: 'IELTS2025',
  })
  @ApiOkResponse({
    description: 'Invite code validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        class: { $ref: '#/components/schemas/ClassResponseDto' },
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async validateInviteCode(
    @Param('code') code: string,
  ): Promise<{ valid: boolean; class: ClassResponseDto | null }> {
    console.log('validateInviteCode route called:', { code });
    return this.classService.validateInviteCode(code);
  }

  @Put(':id/settings')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Update class settings',
    description:
      'Updates class settings including privacy, notifications, and other configuration options. Only class creators or admins can update settings.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiBody({ type: UpdateClassDto })
  @ApiOkResponse({
    description: 'Class settings successfully updated',
    type: ClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description:
      'Access denied - only class creator or ADMIN can update settings',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to update settings - validation errors',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async updateClassSettings(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: UpdateClassDto,
  ): Promise<ClassResponseDto> {
    console.log('updateClassSettings route called:', { classId, user, dto });
    return this.classService.updateClassSettings(classId, user.id, dto);
  }

  @Post(':id/students/bulk')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Bulk add students',
    description:
      'Adds multiple students to a class at once. Only teachers and admins can perform bulk operations.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiBody({ type: BulkStudentIdsDto })
  @ApiOkResponse({
    description: 'Students successfully added to class',
    type: [UserSummaryDto],
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Some students could not be added - check individual results',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async bulkAddStudents(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: BulkStudentIdsDto,
  ): Promise<UserSummaryDto[]> {
    console.log('bulkAddStudents route called:', { classId, user, dto });
    return this.classService.bulkAddStudents(classId, user.id, dto);
  }

  @Delete(':id/students/bulk')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Bulk remove students',
    description:
      'Removes multiple students from a class at once. Only teachers and admins can perform bulk operations.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiBody({ type: BulkStudentIdsDto })
  @ApiOkResponse({
    description: 'Students successfully removed from class',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number', example: 5 },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async bulkRemoveStudents(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
    @Body() dto: BulkStudentIdsDto,
  ): Promise<{ count: number }> {
    console.log('bulkRemoveStudents route called:', { classId, user, dto });
    return this.classService.bulkRemoveStudents(classId, user.id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get class by ID',
    description:
      'Retrieves detailed information about a specific class including members, teachers, and sessions. Only accessible to class members.',
  })
  @ApiParam({
    name: 'id',
    description: 'Class ID',
    example: 'class-uuid-here',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved class details',
    type: FullClassResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Class not found or access denied' })
  @ApiForbiddenResponse({
    description: 'Access denied - must be enrolled in or teaching the class',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getClassById(
    @Param('id') classId: string,
    @CurrentUser() user: userPayload,
  ): Promise<FullClassResponseDto> {
    console.log('getClassById route called:', { classId, user });
    return this.classService.getClassById(classId, user.id);
  }
}
