import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProgressService } from './progress.service';
import { ReadingSubmission } from '../assignment/schemas/reading-submission.schema';
import { ListeningSubmission } from '../assignment/schemas/listening-submission.schema';
import { WritingSubmission } from '../assignment/writing/schemas/writing-submission.schema';
import { SpeakingSubmission } from '../assignment/speaking/schemas/speaking-submission.schema';
import { ReadingAssignment } from '../assignment/schemas/reading-assignment.schema';
import { ListeningAssignment } from '../assignment/schemas/listening-assignment.schema';

describe('ProgressService', () => {
  let service: ProgressService;

  const mockReadingSubmissionModel = {
    find: jest.fn(),
  };
  const mockListeningSubmissionModel = {
    find: jest.fn(),
  };
  const mockWritingSubmissionModel = {
    find: jest.fn(),
  };
  const mockSpeakingSubmissionModel = {
    find: jest.fn(),
  };
  const mockReadingAssignmentModel = {
    find: jest.fn(),
  };
  const mockListeningAssignmentModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: getModelToken(ReadingSubmission.name),
          useValue: mockReadingSubmissionModel,
        },
        {
          provide: getModelToken(ListeningSubmission.name),
          useValue: mockListeningSubmissionModel,
        },
        {
          provide: getModelToken(WritingSubmission.name),
          useValue: mockWritingSubmissionModel,
        },
        {
          provide: getModelToken(SpeakingSubmission.name),
          useValue: mockSpeakingSubmissionModel,
        },
        {
          provide: getModelToken(ReadingAssignment.name),
          useValue: mockReadingAssignmentModel,
        },
        {
          provide: getModelToken(ListeningAssignment.name),
          useValue: mockListeningAssignmentModel,
        },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTimeline', () => {
    it('Case A: 1 Writing graded + 1 pending -> timeline has only 1 point', async () => {
      const mockWritingSubs = [
        {
          _id: 'sub-w-001',
          user_id: 'user-1',
          status: 'graded',
          score: 6.0,
          created_at: new Date(),
        },
      ];

      mockWritingSubmissionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWritingSubs),
        }),
      });

      const result = await service.getTimeline('user-1', 'writing', '90d');
      expect(result.points).toHaveLength(1);
      expect(result.points[0].score).toBe(6.0);
      expect(result.points[0].submissionId).toBe('sub-w-001');
    });

    it('Case C: No submissions in window -> points is empty, direction is unknown', async () => {
      mockReadingSubmissionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getTimeline('user-1', 'reading', '90d');
      expect(result.points).toHaveLength(0);
      expect(result.trend.rollingAverage).toBeNull();
      expect(result.trend.direction).toBe('unknown');
    });
  });

  describe('getQuestionTypes', () => {
    it('Case B: Reading a questionType has 5 items -> confidence is insufficient_data', async () => {
      const mockReadingSubs = [
        {
          _id: 'sub-r-001',
          submitted_by: 'user-1',
          assignment_id: 'assign-1',
          created_at: new Date(),
          details: [
            {
              section_id: 'sec-1',
              section_title: 'Section 1',
              questions: [
                {
                  question_id: 'q-1',
                  correct: true,
                  parts: [
                    { key: 'blank-1', correct: true },
                    { key: 'blank-2', correct: true },
                    { key: 'blank-3', correct: false },
                    { key: 'blank-4', correct: true },
                    { key: 'blank-5', correct: false },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const mockAssignments = [
        {
          _id: 'assign-1',
          sections: [
            {
              id: 'sec-1',
              question_groups: [
                {
                  questions: [
                    {
                      id: 'q-1',
                      type: 'gap_fill_template',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      mockReadingSubmissionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockReadingSubs),
        }),
      });

      mockReadingAssignmentModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAssignments),
        }),
      });

      const result = await service.getQuestionTypes('user-1', 'reading', '90d');
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.questionType).toBe('gap_fill_template');
      expect(item.totalItems).toBe(5);
      expect(item.correctItems).toBe(3);
      expect(item.confidence).toBe('insufficient_data');
      expect(item.classification).toBe('insufficient_data');
    });
  });

  describe('getWritingRubrics', () => {
    it('should return insufficient skeleton if < 3 graded writing submissions', async () => {
      mockWritingSubmissionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      const result = await service.getWritingRubrics('user-1', '90d');
      expect(result.items).toHaveLength(4);
      expect(result.items.every(item => item.averageBand === null)).toBe(true);
    });
  });
});
