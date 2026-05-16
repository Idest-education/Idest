import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SessionService } from './session.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/common/enum/role.enum';

const mockPrisma = {
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  class: {
    findUnique: jest.fn(),
  },
  classTeacher: {
    findFirst: jest.fn(),
  },
  sessionAttendance: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const teacherPayload = {
  id: 'teacher-1',
  email: 'teacher@test.com',
  full_name: 'Teacher One',
  role: Role.TEACHER,
};

const studentPayload = {
  id: 'student-1',
  email: 'student@test.com',
  full_name: 'Student One',
  role: Role.STUDENT,
};

const makeSession = (overrides = {}) => ({
  id: 'session-1',
  class_id: 'class-1',
  host_id: 'teacher-1',
  start_time: new Date('2025-06-01T10:00:00Z'),
  end_time: new Date('2025-06-01T11:00:00Z'),
  is_recorded: false,
  metadata: null,
  class: { id: 'class-1', name: 'English 101' },
  host: { id: 'teacher-1', full_name: 'Teacher One', email: 'teacher@test.com' },
  ...overrides,
});

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrisma },
        // SchedulerRegistry is injected by @Cron decorator support
        { provide: SchedulerRegistry, useValue: { addCronJob: jest.fn() } },
      ],
    }).compile();
    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    const validDto = {
      class_id: 'class-1',
      start_time: '2025-06-01T10:00:00Z',
      end_time: '2025-06-01T11:00:00Z',
    };

    it('creates a session when the caller is a teacher with class access', async () => {
      // checkClassPermission → class.findUnique
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'teacher-1',
        teachers: [],
        members: [],
      });
      // checkSessionConflicts → session.findMany
      mockPrisma.session.findMany.mockResolvedValue([]);
      const session = makeSession();
      mockPrisma.session.create.mockResolvedValue(session);

      const result = await service.createSession(teacherPayload as any, validDto as any);
      expect(result).toEqual(session);
      expect(mockPrisma.session.create).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when caller has no class permission', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'other',
      });
      mockPrisma.classTeacher.findFirst.mockResolvedValue(null);

      await expect(
        service.createSession(studentPayload as any, validDto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnprocessableEntityException for an invalid start_time format', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'teacher-1',
        teachers: [],
        members: [],
      });

      await expect(
        service.createSession(teacherPayload as any, {
          ...validDto,
          start_time: 'not-a-date',
        } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when end_time is before start_time', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'teacher-1',
        teachers: [],
        members: [],
      });

      await expect(
        service.createSession(teacherPayload as any, {
          class_id: 'class-1',
          start_time: '2025-06-01T12:00:00Z',
          end_time: '2025-06-01T10:00:00Z',
        } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getClassSessions', () => {
    it('returns paginated sessions when user has access', async () => {
      // checkClassAccess → class.findUnique
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'teacher-1',
        teachers: [],
        members: [],
      });
      const sessions = [makeSession()];
      mockPrisma.session.findMany.mockResolvedValue(sessions);
      mockPrisma.session.count.mockResolvedValue(1);

      const result = await service.getClassSessions('class-1', 'teacher-1');
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('throws ForbiddenException when user has no access to the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'other',
        teachers: [],
        members: [],
      });

      await expect(
        service.getClassSessions('class-1', 'outsider'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSessionById', () => {
    it('returns a session when it exists and user has access', async () => {
      const session = makeSession();
      mockPrisma.session.findUnique.mockResolvedValue(session);
      mockPrisma.class.findUnique.mockResolvedValue({
        created_by: 'teacher-1',
        teachers: [],
        members: [],
      });

      const result = await service.getSessionById('session-1', 'teacher-1');
      expect(result).toEqual(session);
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.getSessionById('bad-id', 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteSession', () => {
    it('deletes a session when the caller is the host', async () => {
      const session = makeSession({ host_id: 'teacher-1' });
      mockPrisma.session.findUnique.mockResolvedValue(session);
      mockPrisma.session.delete.mockResolvedValue({});

      await expect(service.deleteSession('session-1', 'teacher-1')).resolves.toBe(true);
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('throws ForbiddenException when caller is not the host and not admin', async () => {
      const session = makeSession({ host_id: 'other-teacher' });
      mockPrisma.session.findUnique.mockResolvedValue(session);

      await expect(
        service.deleteSession('session-1', 'student-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.deleteSession('bad-id', 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
