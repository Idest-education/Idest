import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/createUser.dto';
import { userPayload } from 'src/common/types/userPayload.interface';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { UpdateUserDto } from './dto/updateUser.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(user: userPayload, dto: CreateUserDto): Promise<ResponseDto<User | null>> {
    try {
      const createdUser = await this.prisma.user.create({
        data: {
          id: user.id,
          full_name: dto.fullName,
          email: user.email,
          role: dto.role,
          avatar_url: dto.avatar || user.avatar,
        },
      });
      const newUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      return ResponseDto.ok(newUser, 'User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      return ResponseDto.fail('User creation failed');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<ResponseDto<User | null>> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: {
          full_name: dto.fullName,
          role: dto.role,
          avatar_url: dto.avatar,
          is_active: dto.isActive,
        },
      });
      const newUser = await this.prisma.user.findUnique({
        where: { id: updatedUser.id },
      });

      return ResponseDto.ok(newUser, 'User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      return ResponseDto.fail('User update failed');
    }
  }
}
