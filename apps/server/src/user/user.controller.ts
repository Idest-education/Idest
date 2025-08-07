import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
import { ImageInterceptor } from 'src/common/interceptors/image.interceptors';
import { Role } from 'src/common/enum/role.enum';
import { Roles } from 'src/common/decorator/role.decorator';
import { CloudinaryPayload } from 'src/common/types/cloudinaryPayload.interface';
import { CreateStudentProfileDto } from './dto/createStudentProfile.dto';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getCurrentUser(@User() user: userPayload): Promise<ResponseDto> {
    const result: ResponseDto = await this.userService.getUserById(user.id);
    console.log('result:', result);
    return result;
  }

  @Post()
  async createUser(@User() user: userPayload, @Body() request: CreateUserDto) {
    const result: ResponseDto = await this.userService.createUser(
      user,
      request,
    );
    return result;
  }

  @Post('student-profile')
  @Roles(Role.STUDENT)
  async createStudentProfile(
    @User() user: userPayload,
    @Body() request: CreateStudentProfileDto,
  ) {
    const result: ResponseDto = await this.userService.createStudentProfile(
      user,
      request,
    );
    return result;
  }
  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getUserById(@Param('id') id: string) {
    const result = await this.userService.getUserById(id);
    return result;
  }

  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() request: UpdateUserDto) {
    const result: ResponseDto = await this.userService.updateUser(id, request);
    return result;
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('image'), ImageInterceptor)
  async uploadAvatar(
    @User() user: userPayload,
    @Body() image: CloudinaryPayload,
  ): Promise<ResponseDto> {
    console.log('req.user:', user);
    const result: ResponseDto = await this.userService.uploadAvatar(
      image.imageUrl,
      user.id,
    );
    return result;
  }

  @Post('ban/:id')
  @Roles(Role.ADMIN)
  async banUser(
    @Param('id') banned: string,
    @User() banner: userPayload,
  ): Promise<ResponseDto> {
    const result: ResponseDto = await this.userService.banUser(banned, banner);
    return result;
  }

  @Post('unban/:id')
  @Roles(Role.ADMIN)
  async unbanUser(
    @Param('id') unbanned: string,
    @User() unbanner: userPayload,
  ): Promise<ResponseDto> {
    const result: ResponseDto = await this.userService.unbanUser(
      unbanned,
      unbanner,
    );
    return result;
  }
  @Get('all')
  @Roles(Role.ADMIN)
  async getAllUsers(): Promise<ResponseDto> {
    const result: ResponseDto = await this.userService.getAllUsers();
    return result;
  }
}
