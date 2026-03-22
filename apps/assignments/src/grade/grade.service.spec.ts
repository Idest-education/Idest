import { Test, TestingModule } from '@nestjs/testing';
import { GradeService } from './grade.service';
import { RabbitService } from '../rabbit/rabbit.service';
import { ReadingService } from '../assignment/reading/reading.service';
import { ListeningService } from '../assignment/listening/listening.service';
import { WritingService } from '../assignment/writing/writing.service';
import { SpeakingService } from '../assignment/speaking/speaking.service';

describe('GradeService', () => {
  let service: GradeService;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key-for-jest';
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradeService,
        { provide: RabbitService, useValue: { consume: jest.fn() } },
        { provide: ReadingService, useValue: {} },
        { provide: ListeningService, useValue: {} },
        { provide: WritingService, useValue: {} },
        { provide: SpeakingService, useValue: {} },
      ],
    }).compile();

    service = module.get<GradeService>(GradeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
