import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
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

@Controller('class')
@UseGuards(AuthGuard)
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  /**
   * Create a new class
   */
  @Post()
  async createClass(
    @User() user: userPayload,
    @Body() dto: CreateClassDto,
  ): Promise<ResponseDto> {
    return this.classService.createClass(user, dto);
  }

  /**
   * Get all classes for the current user
   */
  @Get()
  async getUserClasses(@User() user: userPayload): Promise<ResponseDto> {
    return this.classService.getUserClasses(user.id);
  }

  /**
   * Get class details by ID
   */
  @Get(':id')
  async getClassById(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.classService.getClassById(classId, user.id);
  }

  /**
   * Update class details
   */
  @Put(':id')
  async updateClass(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: UpdateClassDto,
  ): Promise<ResponseDto> {
    return this.classService.updateClass(classId, user.id, dto);
  }

  /**
   * Delete class
   */
  @Delete(':id')
  async deleteClass(
    @Param('id') classId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.classService.deleteClass(classId, user.id);
  }

  /**
   * Add student to class
   */
  @Post(':id/students')
  async addStudent(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: AddClassMemberDto,
  ): Promise<ResponseDto> {
    return this.classService.addStudent(classId, user.id, dto);
  }

  /**
   * Remove student from class
   */
  @Delete(':id/students/:studentId')
  async removeStudent(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @User() user: userPayload,
  ): Promise<ResponseDto> {
    return this.classService.removeStudent(classId, user.id, studentId);
  }

  /**
   * Add teacher to class
   */
  @Post(':id/teachers')
  async addTeacher(
    @Param('id') classId: string,
    @User() user: userPayload,
    @Body() dto: AddClassTeacherDto,
  ): Promise<ResponseDto> {
    return this.classService.addTeacher(classId, user.id, dto);
  }

  /**
   * Join class by invite code
   */
  @Post('join')
  async joinClass(
    @User() user: userPayload,
    @Body() dto: JoinClassDto,
  ): Promise<ResponseDto> {
    return this.classService.joinClass(user.id, dto.invite_code);
  }
}
