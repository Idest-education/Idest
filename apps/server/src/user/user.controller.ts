import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { User } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateUserDto } from './dto/createUser.dto';
import { UserService } from './user.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImageInterceptor } from 'src/common/interceptors/image.interceptors';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getCurrentUser(@User() user: userPayload) {
    return this.userService.getUserById(user.id);
  }

  @Post()
  async createUser(@User() user: userPayload, @Body() request: CreateUserDto) {
    const result: ResponseDto = await this.userService.createUser(
      user,
      request,
    );
    return result;
  }
  @Get(':id')
  async getUserById(@User() user: userPayload) {
    const result = await this.userService.getUserById(user.id);
    return result;
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() request: UpdateUserDto) {
    const result: ResponseDto = await this.userService.updateUser(
      id,
      request,
    );
    return result;
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('image'), ImageInterceptor)
  async uploadAvatar(
    @User() user: userPayload,
    @Body() image: CloudinaryPayload,
  ): Promise<ResponseDto> {
    console.log('req.user:', user);
    const result: ResponseDto = await this.userService.uploadAvatar(image.imageUrl, user.id);
    return result;
  }

}
