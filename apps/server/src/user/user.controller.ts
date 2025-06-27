import { Controller, Get, Patch, Post } from '@nestjs/common';
import { User } from 'src/common/decorator/currentUser.decorator';
import { userPayload } from 'src/common/types/userPayload.interface';
import { CreateUserDto } from './dto/createUser.dto';
import { UserService } from './user.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { UpdateUserDto } from './dto/updateUser.dto';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
  ) {}

  @Get()
  getCurrentUser(@User() user: userPayload) {
    return user;
  }

  @Post()
  async createUser(@User() user: userPayload, request: CreateUserDto) {
    const result: ResponseDto = await this.userService.createUser(user, request);
    return result;
  }
  @Get(':id')
  async getUserById(@User() user: userPayload) {
    const result = await this.userService.getUserById(user.id);
    return result;
  }

  @Patch(':id')
  async updateUser(
    @User() user: userPayload,
    request: UpdateUserDto,
  ) {
    const result: ResponseDto = await this.userService.updateUser(user.id, request);
    return result;
  }
}
