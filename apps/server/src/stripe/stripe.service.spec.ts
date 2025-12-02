import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { PrismaService } from 'src/prisma/prisma.service';

// Basic sanity test to ensure the StripeService can be instantiated.
describe('StripeService', () => {
  let service: StripeService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: false })],
      providers: [StripeService, PrismaService],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});


