import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service';

const mockSignInWithPassword = jest.fn();
const mockSupabaseService = {
  auth: { signInWithPassword: mockSignInWithPassword },
};

describe('AppService', () => {
  let service: AppService;

  beforeAll(() => {
    process.env.SUPABASE_DEV_EMAIL = 'dev@test.com';
    process.env.SUPABASE_DEV_PASSWORD = 'dev-pass';
    process.env.SECRET_PASS = 'super-secret';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();
    service = module.get<AppService>(AppService);
  });

  it('should be defined', () => { expect(service).toBeDefined(); });

  describe('getDevJwt', () => {
    it('returns access_token when secret is correct', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'jwt-token' } },
        error: null,
      });
      const result = await service.getDevJwt('super-secret');
      expect(result).toEqual({ access_token: 'jwt-token' });
    });

    it('throws ForbiddenException when secret is wrong', async () => {
      await expect(service.getDevJwt('wrong-secret')).rejects.toThrow(ForbiddenException);
    });

    it('throws InternalServerErrorException when env vars are missing', async () => {
      const original = process.env.SUPABASE_DEV_EMAIL;
      delete process.env.SUPABASE_DEV_EMAIL;
      await expect(service.getDevJwt('super-secret')).rejects.toThrow(InternalServerErrorException);
      process.env.SUPABASE_DEV_EMAIL = original;
    });

    it('throws InternalServerErrorException when supabase auth fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: new Error('Invalid credentials'),
      });
      await expect(service.getDevJwt('super-secret')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getDevJwt guarding', () => {
    const OLD = process.env;
    afterEach(() => {
      process.env = OLD;
    });

    it('is disabled in production', async () => {
      process.env = { ...OLD, NODE_ENV: 'production', SECRET_PASS: 'x' };
      const signIn = jest.fn();
      const svc = new AppService({ auth: { signInWithPassword: signIn } } as any);
      await expect(svc.getDevJwt('x')).rejects.toThrow(ForbiddenException);
      expect(signIn).not.toHaveBeenCalled();
    });

    it('rejects a wrong secret without calling Supabase', async () => {
      process.env = {
        ...OLD,
        NODE_ENV: 'development',
        SECRET_PASS: 'right',
        SUPABASE_DEV_EMAIL: 'a@b.co',
        SUPABASE_DEV_PASSWORD: 'p',
      };
      const signIn = jest.fn();
      const svc = new AppService({ auth: { signInWithPassword: signIn } } as any);
      await expect(svc.getDevJwt('wrong')).rejects.toThrow(ForbiddenException);
      expect(signIn).not.toHaveBeenCalled();
    });
  });
});
