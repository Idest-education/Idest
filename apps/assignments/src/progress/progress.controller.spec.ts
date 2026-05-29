import { Test, TestingModule } from '@nestjs/testing';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ExecutionContext, BadRequestException } from '@nestjs/common';

describe('ProgressController', () => {
  let controller: ProgressController;
  let service: ProgressService;

  const mockProgressService = {
    getTimeline: jest.fn(),
    getQuestionTypes: jest.fn(),
    getWritingRubrics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        {
          provide: ProgressService,
          useValue: mockProgressService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'user-123' };
          return true;
        },
      })
      .compile();

    controller = module.get<ProgressController>(ProgressController);
    service = module.get<ProgressService>(ProgressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTimeline', () => {
    it('should fetch timeline successfully with default values', async () => {
      mockProgressService.getTimeline.mockResolvedValue({ ok: true });
      const req = { user: { sub: 'user-123' } };

      const result = await controller.getTimeline(req, undefined, undefined);
      expect(result).toEqual({ ok: true });
      expect(service.getTimeline).toHaveBeenCalledWith('user-123', 'overall', '90d');
    });

    it('should throw BadRequestException if skill is invalid', async () => {
      const req = { user: { sub: 'user-123' } };
      await expect(controller.getTimeline(req, 'invalid-skill' as any, '90d')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getQuestionTypes', () => {
    it('should throw BadRequestException if skill is missing', async () => {
      const req = { user: { sub: 'user-123' } };
      await expect(controller.getQuestionTypes(req, undefined as any, '90d')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call service if skill is valid', async () => {
      mockProgressService.getQuestionTypes.mockResolvedValue({ ok: true });
      const req = { user: { sub: 'user-123' } };

      const result = await controller.getQuestionTypes(req, 'reading', '30d');
      expect(result).toEqual({ ok: true });
      expect(service.getQuestionTypes).toHaveBeenCalledWith('user-123', 'reading', '30d');
    });
  });
});
