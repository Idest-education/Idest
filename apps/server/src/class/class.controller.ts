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
import { User } from 'src/common/decorator/currentUser.decorator';
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

@Controller('class')
@UseGuards(AuthGuard, RolesGuard)
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  /**
   * Create a new class
   */
  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  async createClass(
    @User() user: userPayload,
    @Body() dto: CreateClassDto,
  ): Promise<ResponseDto> {
    console.log('createClass route called:', { user, dto });
    return this.classService.createClass(user, dto);
  }

  /**
   * Get all classes for the current user
   */
  @Get()
  async getUserClasses(@User() user: userPayload): Promise<ResponseDto> {
    console.log('getUserClasses route called:', { user });
    return this.classService.getUserClasses(user.id);
  }

  /**
   * Update class details
   */
  @Put(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async updateClass(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: UpdateClassDto,
  ): Promise<ResponseDto> {
    console.log('updateClass route called:', { classId, user, dto });
    return this.classService.updateClass(classId, user.id, dto);
  }

  /**
   * Delete class
   */
  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async deleteClass(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('deleteClass route called:', { classId, user });
    return this.classService.deleteClass(classId, user.id);
  }

  /**
   * Add student to class
   */
  @Post(':id/students')
  @Roles(Role.TEACHER, Role.ADMIN)
  async addStudent(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: AddClassMemberDto,
  ): Promise<ResponseDto> {
    console.log('addStudent route called:', { classId, user, dto });
    return this.classService.addStudent(classId, user.id, dto);
  }

  /**
   * Remove student from class
   */
  @Delete(':id/students/:studentId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async removeStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('removeStudent route called:', { classId, studentId, user });
    return this.classService.removeStudent(classId, user.id, studentId);
  }

  /**
   * Add teacher to class
   */
  @Post(':id/teachers')
  @Roles(Role.TEACHER, Role.ADMIN)
  async addTeacher(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: AddClassTeacherDto,
  ): Promise<ResponseDto> {
    console.log('addTeacher route called:', { classId, user, dto });
    return this.classService.addTeacher(classId, user.id, dto);
  }

  /**
   * Remove teacher from class
   */
  @Delete(':id/teachers/:teacherId')
  @Roles(Role.TEACHER, Role.ADMIN)
  async removeTeacher(
    @Param('id') classId: string,
    @Param('teacherId') teacherId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('removeTeacher route called:', { classId, teacherId, user });
    return this.classService.removeTeacher(classId, user.id, teacherId);
  }

  /**
   * Join class by invite code
   */
  @Post('join')
  async joinClass(
    @User() user: userPayload,
    @Body() dto: JoinClassDto,
  ): Promise<ResponseDto> {
    console.log('joinClass route called:', { user, dto });
    return this.classService.joinClass(user.id, dto.invite_code);
  }

  /**
   * Leave class (as student or teacher)
   */
  @Delete(':id/leave')
  async leaveClass(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('leaveClass route called:', { classId, user });
    return this.classService.leaveClass(classId, user.id);
  }

  /**
   * Get class members
   */
  @Get(':id/members')
  async getClassMembers(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('getClassMembers route called:', { classId, user });
    return this.classService.getClassMembers(classId, user.id);
  }

  /**
   * Get class teachers
   */
  @Get(':id/teachers')
  async getClassTeachers(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('getClassTeachers route called:', { classId, user });
    return this.classService.getClassTeachers(classId, user.id);
  }

  /**
   * Get class statistics
   */
  @Get(':id/statistics')
  async getClassStatistics(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('getClassStatistics route called:', { classId, user });
    return this.classService.getClassStatistics(classId, user.id);
  }

  /**
   * Get class sessions
   */
  @Get(':id/sessions')
  async getClassSessions(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('getClassSessions route called:', { classId, user });
    // Delegate to session service via class service method to keep imports simple
    return this.classService.getClassSessions(classId, user.id);
  }

  /**
   * Search classes
   */
  @Get('search')
  async searchClasses(
    @User() user: userPayload,
    @Query('q') q?: string,
  ): Promise<ResponseDto> {
    console.log('searchClasses route called:', { user, q });
    return this.classService.searchClasses(user.id, q || '');
  }

  /**
   * Get class by slug
   */
  @Get('slug/:slug')
  async getClassBySlug(
    @Param('slug') slug: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('getClassBySlug route called:', { slug, user });
    return this.classService.getClassBySlug(slug, user.id);
  }

  /**
   * Get all classes with pagination/filter/sort (admin only)
   */
  @Get('all')
  @Roles(Role.ADMIN)
  async getAllClasses(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
    @Query('sortBy')
    sortBy: 'name' | 'created_at' | 'updated_at' = 'updated_at',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'desc',
    @Query('creatorId') creatorId?: string,
  ): Promise<ResponseDto> {
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
   * Get public classes
   */
  @Get('public')
  async getPublicClasses(): Promise<ResponseDto> {
    console.log('getPublicClasses route called');
    return this.classService.getPublicClasses();
  }

  /**
   * Regenerate invite code
   */
  @Put(':id/regenerate-code')
  @Roles(Role.TEACHER, Role.ADMIN)
  async regenerateInviteCode(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('regenerateInviteCode route called:', { classId, user });
    return this.classService.regenerateInviteCode(classId, user.id);
  }

  /**
   * Validate invite code
   */
  @Get('validate-code/:code')
  async validateInviteCode(@Param('code') code: string): Promise<ResponseDto> {
    console.log('validateInviteCode route called:', { code });
    return this.classService.validateInviteCode(code);
  }

  /**
   * Update class settings
   */
  @Put(':id/settings')
  @Roles(Role.TEACHER, Role.ADMIN)
  async updateClassSettings(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: UpdateClassDto,
  ): Promise<ResponseDto> {
    console.log('updateClassSettings route called:', { classId, user, dto });
    return this.classService.updateClassSettings(classId, user.id, dto);
  }

  /**
   * Bulk add students
   */
  @Post(':id/students/bulk')
  @Roles(Role.TEACHER, Role.ADMIN)
  async bulkAddStudents(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: BulkStudentIdsDto,
  ): Promise<ResponseDto> {
    console.log('bulkAddStudents route called:', { classId, user, dto });
    return this.classService.bulkAddStudents(classId, user.id, dto);
  }

  /**
   * Bulk remove students
   */
  @Delete(':id/students/bulk')
  @Roles(Role.TEACHER, Role.ADMIN)
  async bulkRemoveStudents(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: BulkStudentIdsDto,
  ): Promise<ResponseDto> {
    console.log('bulkRemoveStudents route called:', { classId, user, dto });
    return this.classService.bulkRemoveStudents(classId, user.id, dto);
  }

  /**
   * Get class details by ID
   */
  @Get(':id')
  async getClassById(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    console.log('getClassById route called:', { classId, user });
    return this.classService.getClassById(classId, user.id);
  }
}
