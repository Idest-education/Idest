import { Test, TestingModule } from '@nestjs/testing';
import { RabbitService } from './rabbit.service';

describe('RabbitService', () => {
  let service: RabbitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RabbitService],
    }).compile();

    service = module.get<RabbitService>(RabbitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('consume error handling', () => {
  it('nacks (no requeue) when the callback throws', async () => {
    const svc = new RabbitService();
    const ch: any = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((_q, h) => { (ch as any)._h = h; }),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    (svc as any).channel = ch;
    await svc.consume('q', () => { throw new Error('boom'); });
    await ch._h({ content: Buffer.from('{}') });
    expect(ch.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(ch.ack).not.toHaveBeenCalled();
  });
});
