import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('StripeService', () => {
  let service: StripeService;

  beforeAll(async () => {
    const config = {
      get: (k: string) =>
        ({
          STRIPE_SECRET_KEY: 'sk_test_dummy',
          FRONTEND_BASE_URL: 'http://localhost:3000',
        }[k]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});


