import { Test, TestingModule } from '@nestjs/testing';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { AuthGuard } from 'src/common/guard/auth.guard';

const mockService = {
  createClassCheckoutSession: jest.fn(),
  verifyAndCompleteEnrollment: jest.fn(),
};

const user = { id: 'user-1', email: 'user@test.com', full_name: 'User One', role: 'STUDENT' };

describe('StripeController', () => {
  let controller: StripeController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [{ provide: StripeService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = module.get<StripeController>(StripeController);
  });

  it('should be defined', () => { expect(controller).toBeDefined(); });

  describe('createClassCheckoutSession', () => {
    it('delegates to StripeService.createClassCheckoutSession', async () => {
      const expected = { url: 'https://checkout.stripe.com/...' };
      mockService.createClassCheckoutSession.mockResolvedValue(expected);
      const result = await controller.createClassCheckoutSession(user as any, 'class-1');
      expect(mockService.createClassCheckoutSession).toHaveBeenCalledWith('user-1', 'class-1');
      expect(result).toBe(expected);
    });
  });

  describe('verifyAndCompleteEnrollment', () => {
    it('delegates to StripeService.verifyAndCompleteEnrollment', async () => {
      const body = { sessionId: 'cs_test_abc123' };
      const expected = { success: true, alreadyEnrolled: false };
      mockService.verifyAndCompleteEnrollment.mockResolvedValue(expected);
      const result = await controller.verifyAndCompleteEnrollment(user as any, 'class-1', body);
      expect(mockService.verifyAndCompleteEnrollment).toHaveBeenCalledWith('user-1', 'class-1', 'cs_test_abc123');
      expect(result).toBe(expected);
    });
  });
});
