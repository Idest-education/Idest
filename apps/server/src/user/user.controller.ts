import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorator/currentUser.decorator';
import { User } from '@prisma/client';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateUserDto } from './dto/createUser.dto';
import { UserService } from './user.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from 'src/common/enum/role.enum';
import { Roles } from 'src/common/decorator/role.decorator';
import { CreateStudentProfileDto } from './dto/createStudentProfile.dto';
import { CreateTeacherProfileDto } from './dto/createTeacherProfile.dto';
import { AllUsers } from './types/allUsers.type';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getCurrentUser(@CurrentUser() user: userPayload): Promise<User> {
    return await this.userService.getUserById(user.id);
  }

  @Post()
  async createUser(@CurrentUser() user: userPayload) {
    return await this.userService.createUser(user);
  }

  @Post('student-profile')
  @Roles(Role.STUDENT)
  async createStudentProfile(
    @CurrentUser() user: userPayload,
    @Body() request: CreateStudentProfileDto,
  ) {
    return await this.userService.createStudentProfile(
      user,
      request,
    );
  }

  @Post('teacher-profile')
  @Roles(Role.ADMIN)
  async createTeacherProfile(@Body() request: CreateTeacherProfileDto) {
    return await this.userService.createTeacherProfile(request);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getUserById(@Param('id') id: string) {
    return await this.userService.getUserById(id);
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() request: UpdateUserDto) {
    return await this.userService.updateUser(id, request);
  }

  @Post('ban/:id')
  @Roles(Role.ADMIN)
  async banUser(
    @Param('id') banned: string,
    @CurrentUser() banner: userPayload,
  ): Promise<User> {
    return await this.userService.banUser(banned, banner);
  }

  @Post('unban/:id')
  @Roles(Role.ADMIN)
  async unbanUser(
    @Param('id') unbanned: string,
    @CurrentUser() unbanner: userPayload,
  ): Promise<User> {
    return await this.userService.unbanUser(
      unbanned,
      unbanner,
    );
  }
  @Get('all')
  @Roles(Role.ADMIN)
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('filter') filter?: string | string[],
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<AllUsers | null> {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const filtersArray = Array.isArray(filter)
      ? filter
      : filter
        ? filter
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    return await this.userService.getAllUsers(
      pageNum,
      limitNum,
      sortBy,
      filtersArray,
      sortOrder,
    );
  }
}
