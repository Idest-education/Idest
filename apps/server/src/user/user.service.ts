import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CreateUserDto } from './dto/createUser.dto';
import { userPayload } from 'src/common/types/userPayload.interface';
import { Prisma, StudentProfile, TeacherProfile, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseDto } from 'src/common/dto/response.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { CreateStudentProfileDto } from './dto/createStudentProfile.dto';
import { CreateTeacherProfileDto } from './dto/createTeacherProfile.dto';
import { Role } from 'src/common/enum/role.enum';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AllUsers } from './types/allUsers.type';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createUser(user: userPayload): Promise<User> {
    try {
      await this.prisma.user.create({
        data: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar,
        },
      });
      const newUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!newUser) {
        throw new UnprocessableEntityException(`Failed to create user`);
      }

      return newUser;
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error creating user: ${error}`);
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          StudentProfile: true,
          TeacherProfile: true,
        },
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error fetching user by ID: ${error}`);
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.prisma.user.update({
        where: { id },
        data: {
          full_name: dto.fullName,
          role: dto.role,
          avatar_url: dto.avatar,
          is_active: dto.isActive,
        },
      });
      const newUser = await this.prisma.user.findUnique({
        where: { id: id },
      });

      if (!newUser) {
        throw new UnprocessableEntityException(`Failed to update user`);
      }

      return newUser;
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error updating user: ${error}`);
    }
  }

  async uploadAvatar(
    image: string,
    userId: string,
  ): Promise<User> {
    try {
      // Assuming image processing and storage logic is implemented here
      const avatarUrl = image;

      const user = await this.getUserById(userId);
      if(!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      if (user.avatar_url) {
        this.cloudinary.deleteImage(user.avatar_url);
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar_url: avatarUrl },
      });
      const updatedUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!updatedUser) {
        throw new UnprocessableEntityException(`Failed to update user`);
      }

      return updatedUser;
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error uploading avatar: ${error}`);
    }
  }

  async banUser(
    bannedId: string,
    banner: userPayload,
  ): Promise<User> {
    try {
      const bannedUser = await this.prisma.user.findUnique({
        where: { id: bannedId },
      });

      if (!bannedUser) {
        throw new NotFoundException(`User with ID ${bannedId} not found`);
      }

      if (banner.id === bannedId) {
        throw new UnprocessableEntityException(`User with ID ${bannedId} cannot ban themselves`);
      }

      await this.prisma.user.update({
        where: { id: bannedId },
        data: {
          is_active: false,
        },
      });

      if (!bannedUser) {
        throw new UnprocessableEntityException(`Failed to ban user`);
      }

      return bannedUser;
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error banning user: ${error}`);
    }
  }
  async unbanUser(
    unbannedId: string,
    unbanner: userPayload,
  ): Promise<User> {
    try {
      const unbannedUser = await this.prisma.user.findUnique({
        where: { id: unbannedId },
      });

      if (!unbannedUser) {
        throw new NotFoundException(`User with ID ${unbannedId} not found`);
      }

      if (unbanner.id === unbannedId) {
        throw new UnprocessableEntityException(`User with ID ${unbannedId} cannot unban themselves`);
      }

      await this.prisma.user.update({
        where: { id: unbannedId },
        data: {
          is_active: true,
        },
      });

      if (!unbannedUser) {
        throw new UnprocessableEntityException(`Failed to unban user`);
      }

      return unbannedUser;
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error unbanning user: ${error}`);
    }
  }
  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    filter?: string[],
    sortOrder?: 'asc' | 'desc',
  ): Promise<
    AllUsers | null
  > {
    try {
      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const normalizedLimit =
        Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
      const safeLimit = Math.min(100, normalizedLimit);
      const skip = (safePage - 1) * safeLimit;

      const requestedOrder: 'asc' | 'desc' =
        sortOrder === 'asc' ? 'asc' : 'desc';
      const sortKey = (sortBy || '').toString().toLowerCase();

      const orderBy = (() => {
        switch (sortKey) {
          case 'name':
          case 'fullname':
            return { full_name: requestedOrder } as const;
          case 'role':
            return { role: requestedOrder } as const;
          case 'isactive':
          case 'active':
            return { is_active: requestedOrder } as const;
          case 'createdat':
          case 'datecreated':
          case 'created':
            return { created_at: requestedOrder } as const;
          case 'specialization':
            return {
              TeacherProfile: { specialization: requestedOrder },
            } as const;
          default:
            return { created_at: 'desc' as const };
        }
      })();

      // Build where clause from filters
      const where: Prisma.UserWhereInput = (() => {
        if (!filter || filter.length === 0) return {};

        const roles: string[] = [];
        const specializationFilters: string[] = [];
        let search: string | undefined;
        let isActive: boolean | undefined;

        for (const raw of filter) {
          if (!raw) continue;
          const [keyRaw, ...rest] = raw.split(':');
          const key = (keyRaw || '').trim().toLowerCase();
          const value = rest.join(':').trim();
          if (!key || !value) continue;

          switch (key) {
            case 'role':
              roles.push(value.toUpperCase()); // Convert to uppercase to match enum values
              break;
            case 'q':
            case 'search':
              search = value;
              break;
            case 'active':
            case 'isactive': {
              const lowered = value.toLowerCase();
              if (lowered === 'true' || lowered === 'false') {
                isActive = lowered === 'true';
              }
              break;
            }
            case 'specialization':
              specializationFilters.push(value);
              break;
            default:
              break;
          }
        }

        const whereInput: Prisma.UserWhereInput = {};
        if (roles.length) {
          whereInput.role = { in: roles };
        }
        if (typeof isActive === 'boolean') {
          whereInput.is_active = isActive;
        }

        const andConditions: Prisma.UserWhereInput[] = [];
        if (search) {
          andConditions.push({
            OR: [
              { full_name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          });
        }

        if (specializationFilters.length) {
          andConditions.push({
            TeacherProfile: {
              is: {
                OR: specializationFilters.map((spec) => ({
                  specialization: { contains: spec, mode: 'insensitive' },
                })),
              },
            },
          });
        }
        if (andConditions.length) {
          whereInput.AND = andConditions;
        }
        return whereInput;
      })();
      const [total, users] = await this.prisma.$transaction([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          skip,
          take: safeLimit,
          orderBy,
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(total / safeLimit));
      const hasMore = safePage < totalPages;

      return { users, total, page: safePage, limit: safeLimit, totalPages, hasMore };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error fetching users: ${error}`);
    }
  }
  async getUserByEmail(email: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });
      if (!user) {
        throw new NotFoundException(`User with email ${email} not found`);
      }
      return user;
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof NotFoundException) {
        throw error;
      }
      throw new UnprocessableEntityException(`Error fetching user by email: ${error}`);
    }
  }

  async getUserDetails(userId: string): Promise<{
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          full_name: true,
          email: true,
          avatar_url: true,
          role: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return {
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url || undefined,
        role: user.role,
      };
    } catch (error) {
      if (error instanceof UnprocessableEntityException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Failed to get user details for ${userId}: ${error}`);
    }
  }
  async createStudentProfile(
    user: userPayload,
    dto: CreateStudentProfileDto,
  ): Promise<StudentProfile> {
    try {
      const studentProfile = await this.prisma.studentProfile.create({
        data: {
          user_id: user.id,
          target_score: dto.target_score,
          current_level: dto.current_level,
        },
      });
      if (!studentProfile) {
        throw new UnprocessableEntityException(`Failed to create student profile`);
      }
      return studentProfile;
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error creating student profile: ${error}`);
    }
  }
  async createTeacherProfile(
    dto: CreateTeacherProfileDto,
  ): Promise<TeacherProfile> {
    try {
      const invitedUser = await this.supabaseService.inviteUserByEmail(
        dto.email,
        { fullName: dto.fullName, role: Role.TEACHER },
      );

      const supabaseUserId = invitedUser?.id;
      if (!supabaseUserId) {
        throw new UnprocessableEntityException(`Failed to invite user by email: ${dto.email}`);
      }

      const teacherProfile = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: supabaseUserId,
            full_name: dto.fullName,
            email: dto.email,
            role: Role.TEACHER,
            avatar_url: dto.avatar,
            is_active: true,
          },
        });

        return tx.teacherProfile.create({
          data: {
            user_id: user.id,
            degree: dto.degree,
            specialization: dto.specialization.join(','),
            bio: dto.bio,
          },
        });
      });

      if (!teacherProfile) {
        throw new UnprocessableEntityException(`Failed to create teacher profile`);
      }

      return teacherProfile;
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error creating teacher profile: ${error}`);
    }
  }
}
