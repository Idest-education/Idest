import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';

describe('UserService.createUserWithCredentials', () => {
  let service: UserService;
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data })),
    },
  };
  const supabase = {
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    service = mod.get(UserService);
  });

  it('persists role STUDENT even if the caller smuggles role: ADMIN', async () => {
    await service.createUserWithCredentials({
      email: 'a@b.com',
      password: 'password123',
      fullName: 'Mallory',
      // @ts-expect-error — role is no longer part of CredDto
      role: 'ADMIN',
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'STUDENT' }) }),
    );
    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ role: 'STUDENT' }),
        }),
      }),
    );
  });
});

describe('UserService.updateUser HttpException propagation', () => {
  it('updateUser: a non-admin editing another user gets 403, not 500', async () => {
    const prismaLocal = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'target', role: 'STUDENT' }),
        update: jest.fn(),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaLocal },
        { provide: SupabaseService, useValue: {} },
      ],
    }).compile();
    const svc = mod.get(UserService);
    await expect(
      svc.updateUser('target', { fullName: 'x' } as any, {
        id: 'someone-else',
        role: 'STUDENT',
      } as any),
    ).rejects.toMatchObject({ status: 403 });
  });
});
