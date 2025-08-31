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
import { User } from 'src/common/decorator/currentUser.decorator';
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

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getCurrentUser(@User() user: userPayload): Promise<ResponseDto> {
    const result = await this.userService.getUserById(user.id);
    if (!result) {
      return ResponseDto.fail('User not found');
    }
    return ResponseDto.ok(result, 'User fetched successfully');
  }

  @Post()
  async createUser(@User() user: userPayload) {
    const result = await this.userService.createUser(user);
    if (!result) {
      return ResponseDto.fail('User creation failed');
    }
    return ResponseDto.ok(result, 'User created successfully');
    return result;
  }

  @Post('student-profile')
  @Roles(Role.STUDENT)
  async createStudentProfile(
    @User() user: userPayload,
    @Body() request: CreateStudentProfileDto,
  ) {
    const result = await this.userService.createStudentProfile(
      user,
      request,
    );
    if (!result) {
      return ResponseDto.fail('Student profile creation failed');
    }
    return ResponseDto.ok(result, 'Student profile created successfully');
    return result;
  }

  @Post('teacher-profile')
  @Roles(Role.ADMIN)
  async createTeacherProfile(@Body() request: CreateTeacherProfileDto) {
    const result =
      await this.userService.createTeacherProfile(request);
    if (!result) {
      return ResponseDto.fail('Teacher profile creation failed');
    }
    return ResponseDto.ok(result, 'Teacher profile created successfully');
    return result;
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getUserById(@Param('id') id: string) {
    const result = await this.userService.getUserById(id);
    if (!result) {
      return ResponseDto.fail('User not found');
    }
    return ResponseDto.ok(result, 'User fetched successfully');
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() request: UpdateUserDto) {
    const result = await this.userService.updateUser(id, request);
    if (!result) {
      return ResponseDto.fail('User update failed');
    }
    return ResponseDto.ok(result, 'User updated successfully');
  }

  @Post('ban/:id')
  @Roles(Role.ADMIN)
  async banUser(
    @Param('id') banned: string,
    @User() banner: userPayload,
  ): Promise<ResponseDto> {
    const result = await this.userService.banUser(banned, banner);
    if (!result) {
      return ResponseDto.fail('User not found');
    }
    return ResponseDto.ok(result, 'User banned successfully');
  }

  @Post('unban/:id')
  @Roles(Role.ADMIN)
  async unbanUser(
    @Param('id') unbanned: string,
    @User() unbanner: userPayload,
  ): Promise<ResponseDto> {
    const result = await this.userService.unbanUser(
      unbanned,
      unbanner,
    );
    if (!result) {
      return ResponseDto.fail('User not found');
    }
    return ResponseDto.ok(result, 'User unbanned successfully');
  }
  @Get('all')
  @Roles(Role.ADMIN)
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('filter') filter?: string | string[],
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ): Promise<ResponseDto> {
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
    const result = await this.userService.getAllUsers(
      pageNum,
      limitNum,
      sortBy,
      filtersArray,
      sortOrder,
    );
    if (!result) {
      return ResponseDto.fail('Users not found');
    }
    return ResponseDto.ok(result, 'Users fetched successfully');
  }
}
