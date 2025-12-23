import {
  Body,
  Controller,
  Delete,
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
import { RolesGuard } from 'src/common/guard/role.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from 'src/common/enum/role.enum';
import { Roles } from 'src/common/decorator/role.decorator';
import { AllUsers, AllUsersDto } from './types/allUsers.type';
import {
  UserResponseDto,
} from './dto/user-response.dto';
import { SearchUsersResponseDto } from './dto/search-users.dto';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiInternalServerErrorResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { CredDto } from './dto/cred.dto';
import { Public } from 'src/common/decorator/public.decorator';

@Controller('user')
@ApiTags('User')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user',
    description:
      "Retrieves the current authenticated user's information including their profile details.",
  })
  @ApiOkResponse({
    description: 'Successfully retrieved current user information',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getCurrentUser(@CurrentUser() user: userPayload): Promise<User> {
    return await this.userService.getUserById(user.id);
  }

  @Get('role')
  @ApiOperation({
    summary: 'Get current user role',
    description:
      "Retrieves the current authenticated user's role from the database.",
  })
  @ApiOkResponse({
    description: 'Successfully retrieved user role',
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['ADMIN', 'STUDENT', 'TEACHER'],
          example: 'STUDENT',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getUserRole(
    @CurrentUser() user: userPayload,
  ): Promise<{ role: string }> {
    return await this.userService.getUserRole(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create user',
    description:
      "Creates a new user account using the authenticated user's information from the **Supabase JWT token**.",
  })
  @ApiOkResponse({
    description: 'User successfully created',
    type: UserResponseDto,
  })
  @ApiBody({ type: CreateUserDto })
  @ApiUnprocessableEntityResponse({
    description:
      'Failed to create user - validation errors or user already exists',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createUser(@CurrentUser() user: userPayload) {
    return await this.userService.createUser(user);
  }

  @Public()
  @Post('serverside-create')
  @ApiOperation({
    summary:
      'Server side user creation (skip client side supabase implementation) ',
    description: 'Creates a new user account using the credentials provided.',
  })
  @ApiOkResponse({
    description: 'User successfully created',
    type: UserResponseDto,
  })
  @ApiBody({ type: CredDto })
  @ApiConflictResponse({ description: 'User already exists' })
  @ApiUnprocessableEntityResponse({ description: 'Credentials insufficient' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async createUserWithCredentials(@Body() credentials: CredDto) {
    return await this.userService.createUserWithCredentials(credentials);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search users by name',
    description:
      'Searches users by full name (case-insensitive). Students cannot see ADMIN users in results.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query (full name)',
    example: 'john',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved search results',
    type: SearchUsersResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async searchUsers(
    @Query('q') query: string,
    @CurrentUser() user: userPayload,
  ): Promise<SearchUsersResponseDto> {
    return await this.userService.searchUsers(query, user.id);
  }

  @Get('all')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a paginated list of all users with filtering and sorting options. Only accessible by users with ADMIN role.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (max 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Field to sort by',
    example: 'name',
    enum: ['name', 'role', 'active', 'created', 'specialization'],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    description:
      'Filters in format key:value. Multiple filters can be comma-separated. Examples: role:STUDENT, search:john, active:true, specialization:math',
    example: 'role:STUDENT,active:true',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved users list',
    type: AllUsersDto,
  })
  @ApiForbiddenResponse({ description: 'Access denied - ADMIN role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
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

  @Get(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Get user by ID',
    description:
      'Retrieves a specific user by their ID. Only accessible by users with TEACHER or ADMIN roles.',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: 'uuid-string' })
  @ApiOkResponse({
    description: 'Successfully retrieved user information',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - TEACHER or ADMIN role required',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async getUserById(@Param('id') id: string) {
    return await this.userService.getUserById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update user',
    description:
      'Updates user information by ID. Users can update their own name and avatar. Only admins can update other users or change roles/active status.',
  })
  @ApiParam({ name: 'id', description: 'User ID', example: 'uuid-string' })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({
    description: 'User successfully updated',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - only admins can update other users or change roles/status',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Failed to update user',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async updateUser(
    @Param('id') id: string,
    @Body() request: UpdateUserDto,
    @CurrentUser() currentUser: userPayload,
  ) {
    return await this.userService.updateUser(id, request, currentUser);
  }

  @Post('ban/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Ban user',
    description:
      'Bans a user by setting their active status to false. Only accessible by users with ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of user to ban',
    example: 'uuid-string',
  })
  @ApiOkResponse({
    description: 'User successfully banned',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Cannot ban yourself or failed to ban user',
  })
  @ApiForbiddenResponse({ description: 'Access denied - ADMIN role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async banUser(
    @Param('id') banned: string,
    @CurrentUser() banner: userPayload,
  ): Promise<boolean> {
    return await this.userService.banUser(banned, banner);
  }

  @Post('unban/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Unban user',
    description:
      'Unbans a user by setting their active status to true. Only accessible by users with ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of user to unban',
    example: 'uuid-string',
  })
  @ApiOkResponse({
    description: 'User successfully unbanned',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Cannot unban yourself or failed to unban user',
  })
  @ApiForbiddenResponse({ description: 'Access denied - ADMIN role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async unbanUser(
    @Param('id') unbanned: string,
    @CurrentUser() unbanner: userPayload,
  ): Promise<boolean> {
    return await this.userService.unbanUser(unbanned, unbanner);
  }

  @Delete('delete/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Delete account (soft delete)',
    description:
      'Soft deletes a user account by anonymizing their data: changes email to @bannedAccount.com, sets name to "Inactive", sets is_active to false, and removes avatar. Only accessible by users with ADMIN role.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID of user account to delete',
    example: 'uuid-string',
  })
  @ApiOkResponse({
    description: 'Account successfully deleted',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnprocessableEntityResponse({
    description: 'Cannot delete your own account or failed to delete account',
  })
  @ApiForbiddenResponse({ description: 'Access denied - ADMIN role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async deleteAccount(
    @Param('id') deletedUserId: string,
    @CurrentUser() deleter: userPayload,
  ): Promise<boolean> {
    return await this.userService.deleteAccount(deletedUserId, deleter);
  }

  @Delete('me')
  @ApiOperation({
    summary: 'Delete own account (soft delete)',
    description:
      'Allows the current authenticated user to anonymize and deactivate their own account.',
  })
  @ApiOkResponse({
    description: 'Account successfully deleted',
    schema: { type: 'boolean', example: true },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async deleteOwnAccount(@CurrentUser() user: userPayload): Promise<boolean> {
    return await this.userService.deleteAccount(user.id, user, true);
  }
}
