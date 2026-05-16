import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';

const mockInviteUserByEmail = jest.fn();
const mockAuthAdmin = { inviteUserByEmail: mockInviteUserByEmail };
const mockAuth = {};
const mockClient = { auth: { admin: mockAuthAdmin } };
const mockAuthClient = { auth: mockAuth };

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeAll(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Re-mock createClient since clearAllMocks resets return values
    const { createClient } = require('@supabase/supabase-js');
    (createClient as jest.Mock)
      .mockReturnValueOnce(mockClient)
      .mockReturnValueOnce(mockAuthClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [SupabaseService],
    }).compile();
    service = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('inviteUserByEmail', () => {
    it('returns invited user', async () => {
      const invited = { id: 'user-1', email: 'user@test.com' };
      mockInviteUserByEmail.mockResolvedValue({ data: { user: invited }, error: null });
      const result = await service.inviteUserByEmail('user@test.com', { name: 'Test User' });
      expect(mockInviteUserByEmail).toHaveBeenCalledWith('user@test.com', { data: { name: 'Test User' } });
      expect(result).toBe(invited);
    });

    it('throws when supabase returns an error', async () => {
      const supabaseError = new Error('Email already registered');
      mockInviteUserByEmail.mockResolvedValue({ data: null, error: supabaseError });
      await expect(service.inviteUserByEmail('user@test.com')).rejects.toThrow('Email already registered');
    });
  });
});
