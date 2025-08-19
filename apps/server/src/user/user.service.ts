import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Injectable } from '@nestjs/common';
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

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createUser(
    user: userPayload,
  ): Promise<ResponseDto<User | null>> {
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

      return ResponseDto.ok(newUser, 'User created successfully');
    } catch (error) {
      console.error('Error creating user:', error);
      return ResponseDto.fail('User creation failed');
    }
  }

  async getUserById(id: string): Promise<ResponseDto<User | null>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          StudentProfile: true,
          TeacherProfile: true,
        },
      });
      console.log('userishere:', user);
      if (!user) {
        return ResponseDto.fail('User not found');
      }
      return ResponseDto.ok(user, 'User fetched successfully');
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return ResponseDto.fail('User fetch failed');
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
  ): Promise<ResponseDto<User | null>> {
    try {
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

      return ResponseDto.ok(newUser, 'User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      return ResponseDto.fail('User update failed');
    }
  }

  async uploadAvatar(
    image: string,
    userId: string,
  ): Promise<ResponseDto<User | null>> {
    try {
      // Assuming image processing and storage logic is implemented here
      const avatarUrl = image;

      const user = await this.getUserById(userId);
      if (user.data?.avatar_url) {
        this.cloudinary.deleteImage(user.data.avatar_url);
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar_url: avatarUrl },
      });
      const updatedUser = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      return ResponseDto.ok(updatedUser, 'Avatar uploaded successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return ResponseDto.fail('Avatar upload failed');
    }
  }

  async banUser(
    bannedId: string,
    banner: userPayload,
  ): Promise<ResponseDto<User | null>> {
    try {
      const bannedUser = await this.prisma.user.findUnique({
        where: { id: bannedId },
      });

      if (!bannedUser) {
        return ResponseDto.fail('User not found');
      }

      if (banner.id === bannedId) {
        return ResponseDto.fail('You cannot ban yourself');
      }

      await this.prisma.user.update({
        where: { id: bannedId },
        data: {
          is_active: false,
        },
      });

      return ResponseDto.ok(bannedUser, 'User banned successfully');
    } catch (error) {
      console.error('Error banning user:', error);
      return ResponseDto.fail('Ban operation failed');
    }
  }
  async unbanUser(
    unbannedId: string,
    unbanner: userPayload,
  ): Promise<ResponseDto<User | null>> {
    try {
      const unbannedUser = await this.prisma.user.findUnique({
        where: { id: unbannedId },
      });

      if (!unbannedUser) {
        return ResponseDto.fail('User not found');
      }

      if (unbanner.id === unbannedId) {
        return ResponseDto.fail('You cannot unban yourself');
      }

      await this.prisma.user.update({
        where: { id: unbannedId },
        data: {
          is_active: true,
        },
      });

      return ResponseDto.ok(unbannedUser, 'User unbanned successfully');
    } catch (error) {
      console.error('Error unbanning user:', error);
      return ResponseDto.fail('Unban operation failed');
    }
  }
  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    filter?: string[],
    sortOrder?: 'asc' | 'desc',
  ): Promise<
    ResponseDto<{
      users: User[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasMore: boolean;
    } | null>
  > {
    try {
      console.log('number 0');
      const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
      const normalizedLimit =
        Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
      const safeLimit = Math.min(100, normalizedLimit);
      const skip = (safePage - 1) * safeLimit;

      const requestedOrder: 'asc' | 'desc' =
        sortOrder === 'asc' ? 'asc' : 'desc';
      const sortKey = (sortBy || '').toString().toLowerCase();
      console.log('number 1');

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
      console.log('number 2');

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
        console.log('number 3');

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
        console.log('number 4');

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
      console.log('number 5');
      const [total, users] = await this.prisma.$transaction([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          skip,
          take: safeLimit,
          orderBy,
        }),
      ]);
      console.log('number 6');
      const totalPages = Math.max(1, Math.ceil(total / safeLimit));
      const hasMore = safePage < totalPages;
      console.log('prob success');

      return ResponseDto.ok(
        { users, total, page: safePage, limit: safeLimit, totalPages, hasMore },
        'Users fetched successfully',
      );
    } catch (error) {
      console.error('Error fetching users:', error);
      return ResponseDto.fail('Failed to fetch users');
    }
  }
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  async getUserDetails(userId: string): Promise<{
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  } | null> {
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

      if (!user) return null;

      return {
        full_name: user.full_name,
        email: user.email,
        avatar_url: user.avatar_url || undefined,
        role: user.role,
      };
    } catch (error) {
      console.error(`Failed to get user details for ${userId}:`, error);
      return null;
    }
  }
  async createStudentProfile(
    user: userPayload,
    dto: CreateStudentProfileDto,
  ): Promise<ResponseDto<StudentProfile | null>> {
    try {
      const studentProfile = await this.prisma.studentProfile.create({
        data: {
          user_id: user.id,
          target_score: dto.target_score,
          current_level: dto.current_level,
        },
      });
      return ResponseDto.ok(
        studentProfile,
        'Student profile updated successfully',
      );
    } catch (error) {
      console.error('Error creating student profile:', error);
      return ResponseDto.fail('Student profile creation failed');
    }
  }
  async createTeacherProfile(
    dto: CreateTeacherProfileDto,
  ): Promise<ResponseDto<TeacherProfile | null>> {
    try {
      const invitedUser = await this.supabaseService.inviteUserByEmail(
        dto.email,
        { fullName: dto.fullName, role: Role.TEACHER },
      );

      const supabaseUserId = invitedUser?.id;
      if (!supabaseUserId) {
        return ResponseDto.fail('Failed to create Supabase user');
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

      return ResponseDto.ok(
        teacherProfile,
        'Teacher profile created successfully',
      );
    } catch (error) {
      console.error('Error creating teacher profile:', error);
      return ResponseDto.fail('Teacher profile creation failed');
    }
  }
}
