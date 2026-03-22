import { Test, TestingModule } from '@nestjs/testing';
import { GradeController } from './grade.controller';
import { RabbitService } from '../rabbit/rabbit.service';

describe('GradeController', () => {
  let controller: GradeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GradeController],
      providers: [{ provide: RabbitService, useValue: { send: jest.fn() } }],
    }).compile();

    controller = module.get<GradeController>(GradeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
