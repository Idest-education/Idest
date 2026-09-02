import { GradeService, TransientGradingError } from './grade.service';
import { TransientError } from '../rabbit/rabbit.service';

// The GradeService constructor eagerly builds an OpenAI client, which refuses
// to construct without a key. Grading logic under test never calls OpenAI.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

describe('GradeService.processGradeMessage', () => {
  const rabbit = { consume: jest.fn() } as any;
  const reading = { gradeSubmission: jest.fn() } as any;
  const listening = { gradeSubmission: jest.fn() } as any;
  const svc = new GradeService(rabbit, reading, listening);

  afterEach(() => jest.clearAllMocks());

  it('does not throw on an unknown skill type (logs and returns)', async () => {
    await expect(
      (svc as any).processGradeMessage({ skill: 'nonsense' }),
    ).resolves.toBeUndefined();
    expect(reading.gradeSubmission).not.toHaveBeenCalled();
    expect(listening.gradeSubmission).not.toHaveBeenCalled();
  });

  it('wraps a downstream reading failure as TransientGradingError', async () => {
    reading.gradeSubmission.mockRejectedValueOnce(new Error('mongo timeout'));
    await expect(
      (svc as any).processGradeMessage({
        skill: 'reading',
        assignmentId: 'a',
        userId: 'u',
        sections: [],
      }),
    ).rejects.toBeInstanceOf(TransientGradingError);
  });

  it('TransientGradingError is a TransientError subclass so RabbitService retries it', async () => {
    reading.gradeSubmission.mockRejectedValueOnce(new Error('boom'));
    await expect(
      (svc as any).processGradeMessage({ skill: 'reading', sections: [] }),
    ).rejects.toBeInstanceOf(TransientError);
  });

  it('resolves when a listening grade succeeds', async () => {
    listening.gradeSubmission.mockResolvedValueOnce({ score: 7 });
    await expect(
      (svc as any).processGradeMessage({
        skill: 'listening',
        assignmentId: 'a',
        userId: 'u',
        sections: [],
      }),
    ).resolves.toBeUndefined();
    expect(listening.gradeSubmission).toHaveBeenCalledTimes(1);
  });
});
