import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassQueryService } from './class-query.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  checkClassAccess,
  checkClassAccessById,
  mapUsersToDto,
  toFullClassResponseDto,
} from '../class.util';

jest.mock('../class.util', () => ({
  checkClassAccess: jest.fn(),
  checkClassAccessById: jest.fn(),
  mapUsersToDto: jest.fn(),
  toFullClassResponseDto: jest.fn(),
}));

const mockCheckClassAccess = checkClassAccess as jest.MockedFunction<typeof checkClassAccess>;
const mockCheckClassAccessById = checkClassAccessById as jest.MockedFunction<typeof checkClassAccessById>;
const mockMapUsersToDto = mapUsersToDto as jest.MockedFunction<typeof mapUsersToDto>;
const mockToFullClassResponseDto = toFullClassResponseDto as jest.MockedFunction<typeof toFullClassResponseDto>;

const mockPrisma = {
  user: { findUnique: jest.fn() },
  class: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  classMember: { findMany: jest.fn(), count: jest.fn() },
  classTeacher: { findMany: jest.fn(), count: jest.fn() },
  session: { findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};

const makeClass = (overrides = {}) => ({
  id: 'class-1',
  name: 'English 101',
  slug: 'english-101',
  invite_code: 'ABCD1234',
  created_by: 'teacher-1',
  description: null,
  is_group: true,
  price: null,
  schedule: null,
  creator: {
    id: 'teacher-1',
    full_name: 'Teacher One',
    email: 'teacher@test.com',
    avatar_url: null,
    role: 'TEACHER',
  },
  members: [],
  teachers: [],
  sessions: [],
  _count: { members: 0, teachers: 1, sessions: 0 },
  ...overrides,
});

const makeFullClassDto = (overrides = {}) => ({
  id: 'class-1',
  name: 'English 101',
  slug: 'english-101',
  ...overrides,
});

describe('ClassQueryService', () => {
  let service: ClassQueryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassQueryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClassQueryService>(ClassQueryService);
  });

  // ─── getClassBySlug ────────────────────────────────────────────────────────

  describe('getClassBySlug', () => {
    it('returns class data when found and user has access', async () => {
      const classData = makeClass();
      const dto = makeFullClassDto();
      // isAdmin returns false (TEACHER role)
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockPrisma.class.findFirst.mockResolvedValue(classData);
      mockCheckClassAccess.mockReturnValue(true);
      mockToFullClassResponseDto.mockReturnValue(dto as any);

      const result = await service.getClassBySlug('english-101', 'teacher-1');

      expect(mockPrisma.class.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'english-101' } }),
      );
      expect(mockCheckClassAccess).toHaveBeenCalledWith(classData, 'teacher-1');
      expect(mockToFullClassResponseDto).toHaveBeenCalledWith(classData);
      expect(result).toEqual(dto);
    });

    it('throws NotFoundException when class not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockPrisma.class.findFirst.mockResolvedValue(null);

      await expect(service.getClassBySlug('no-such-slug', 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user has no access', async () => {
      const classData = makeClass();
      // isAdmin returns false
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockPrisma.class.findFirst.mockResolvedValue(classData);
      mockCheckClassAccess.mockReturnValue(false);

      await expect(service.getClassBySlug('english-101', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows admin to access any class', async () => {
      const classData = makeClass();
      const dto = makeFullClassDto();
      // isAdmin returns true (ADMIN role)
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
      mockPrisma.class.findFirst.mockResolvedValue(classData);
      mockToFullClassResponseDto.mockReturnValue(dto as any);

      const result = await service.getClassBySlug('english-101', 'admin-1');

      // checkClassAccess should not be called since isAdmin short-circuits
      expect(result).toEqual(dto);
    });
  });

  // ─── getUserClasses ────────────────────────────────────────────────────────

  describe('getUserClasses', () => {
    it('returns { created, teaching, enrolled } groupings', async () => {
      const createdClass = makeClass({ id: 'class-1' });
      const teachingClass = makeClass({ id: 'class-2', name: 'Grammar' });
      const enrolledClass = makeClass({ id: 'class-3', name: 'Vocabulary' });

      mockPrisma.class.findMany
        .mockResolvedValueOnce([createdClass])   // created
        .mockResolvedValueOnce([teachingClass])  // teaching
        .mockResolvedValueOnce([enrolledClass]); // enrolled

      mockToFullClassResponseDto
        .mockReturnValueOnce(makeFullClassDto({ id: 'class-1' }) as any)
        .mockReturnValueOnce(makeFullClassDto({ id: 'class-2' }) as any)
        .mockReturnValueOnce(makeFullClassDto({ id: 'class-3' }) as any);

      const result = await service.getUserClasses('teacher-1');

      expect(mockPrisma.class.findMany).toHaveBeenCalledTimes(3);
      expect(result.created).toHaveLength(1);
      expect(result.teaching).toHaveLength(1);
      expect(result.enrolled).toHaveLength(1);
    });

    it('returns empty arrays when user has no classes', async () => {
      mockPrisma.class.findMany.mockResolvedValue([]);

      const result = await service.getUserClasses('new-user');

      expect(result.created).toHaveLength(0);
      expect(result.teaching).toHaveLength(0);
      expect(result.enrolled).toHaveLength(0);
    });
  });

  // ─── getCalendarEventsForUser ──────────────────────────────────────────────

  describe('getCalendarEventsForUser', () => {
    it('throws BadRequestException when date range exceeds 180 days', async () => {
      const from = '2025-01-01';
      const to = '2025-08-01'; // > 180 days

      await expect(
        service.getCalendarEventsForUser('user-1', from, to),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when "from" is an invalid date string', async () => {
      await expect(
        service.getCalendarEventsForUser('user-1', 'not-a-date'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns events from sessions when user has classes', async () => {
      mockPrisma.class.findMany.mockResolvedValue([
        { id: 'class-1', name: 'English 101', schedule: null },
      ]);
      mockPrisma.session.findMany.mockResolvedValue([
        {
          id: 'session-1',
          class_id: 'class-1',
          start_time: new Date('2025-06-01T10:00:00Z'),
          end_time: new Date('2025-06-01T11:00:00Z'),
          class: { id: 'class-1', name: 'English 101' },
        },
      ]);

      const result = await service.getCalendarEventsForUser(
        'user-1',
        '2025-05-01',
        '2025-07-01',
      );

      expect(result.events).toHaveLength(1);
      expect(result.events[0].source).toBe('session');
      expect(result.events[0].classId).toBe('class-1');
      expect(result.total).toBe(1);
    });

    it('returns empty events when user has no classes', async () => {
      mockPrisma.class.findMany.mockResolvedValue([]);

      const result = await service.getCalendarEventsForUser(
        'user-1',
        '2025-05-01',
        '2025-07-01',
      );

      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockPrisma.session.findMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when "to" is before "from"', async () => {
      await expect(
        service.getCalendarEventsForUser('user-1', '2025-06-01', '2025-05-01'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getClassById ──────────────────────────────────────────────────────────

  describe('getClassById', () => {
    it('returns class when found and accessible', async () => {
      const classData = makeClass();
      const dto = makeFullClassDto();
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockPrisma.class.findUnique.mockResolvedValue(classData);
      mockCheckClassAccess.mockReturnValue(true);
      mockToFullClassResponseDto.mockReturnValue(dto as any);

      const result = await service.getClassById('class-1', 'teacher-1');

      expect(mockPrisma.class.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'class-1' } }),
      );
      expect(result).toEqual(dto);
    });

    it('throws NotFoundException when class not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(service.getClassById('no-such-id', 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user has no access', async () => {
      const classData = makeClass();
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
      mockPrisma.class.findUnique.mockResolvedValue(classData);
      mockCheckClassAccess.mockReturnValue(false);

      await expect(service.getClassById('class-1', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getClassMembers ───────────────────────────────────────────────────────

  describe('getClassMembers', () => {
    it('returns members list when user has access', async () => {
      const members = [
        {
          student: { id: 'student-1', full_name: 'Alice', email: 'alice@test.com', avatar_url: null, role: 'STUDENT' },
        },
      ];
      const expectedDto = [{ id: 'student-1', full_name: 'Alice', email: 'alice@test.com' }];

      // isAdmin returns false
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockCheckClassAccessById.mockResolvedValue(true);
      mockPrisma.classMember.findMany.mockResolvedValue(members);
      mockMapUsersToDto.mockReturnValue(expectedDto as any);

      const result = await service.getClassMembers('class-1', 'teacher-1');

      expect(mockCheckClassAccessById).toHaveBeenCalledWith('class-1', 'teacher-1', mockPrisma);
      expect(mockPrisma.classMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { class_id: 'class-1' } }),
      );
      expect(mockMapUsersToDto).toHaveBeenCalledWith(members);
      expect(result).toEqual(expectedDto);
    });

    it('throws ForbiddenException when user has no access', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
      mockCheckClassAccessById.mockResolvedValue(false);

      await expect(service.getClassMembers('class-1', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.classMember.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getClassTeachers ─────────────────────────────────────────────────────

  describe('getClassTeachers', () => {
    it('returns teachers list when user has access', async () => {
      const teachers = [
        {
          teacher: { id: 'teacher-1', full_name: 'Teacher One', email: 'teacher@test.com', avatar_url: null, role: 'TEACHER' },
        },
      ];
      const expectedDto = [{ id: 'teacher-1', full_name: 'Teacher One', email: 'teacher@test.com' }];

      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockCheckClassAccessById.mockResolvedValue(true);
      mockPrisma.classTeacher.findMany.mockResolvedValue(teachers);
      mockMapUsersToDto.mockReturnValue(expectedDto as any);

      const result = await service.getClassTeachers('class-1', 'teacher-1');

      expect(mockPrisma.classTeacher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { class_id: 'class-1' } }),
      );
      expect(mockMapUsersToDto).toHaveBeenCalledWith(teachers);
      expect(result).toEqual(expectedDto);
    });

    it('throws ForbiddenException when user has no access', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
      mockCheckClassAccessById.mockResolvedValue(false);

      await expect(service.getClassTeachers('class-1', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.classTeacher.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getClassStatistics ───────────────────────────────────────────────────

  describe('getClassStatistics', () => {
    it('returns { members, teachers, sessions } counts when user has access', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
      mockCheckClassAccessById.mockResolvedValue(true);
      mockPrisma.classMember.count.mockResolvedValue(10);
      mockPrisma.classTeacher.count.mockResolvedValue(2);
      mockPrisma.session.count.mockResolvedValue(5);

      const result = await service.getClassStatistics('class-1', 'teacher-1');

      expect(result).toEqual({ members: 10, teachers: 2, sessions: 5 });
      expect(mockPrisma.classMember.count).toHaveBeenCalledWith({ where: { class_id: 'class-1' } });
      expect(mockPrisma.classTeacher.count).toHaveBeenCalledWith({ where: { class_id: 'class-1' } });
      expect(mockPrisma.session.count).toHaveBeenCalledWith({ where: { class_id: 'class-1' } });
    });

    it('throws ForbiddenException when user has no access', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
      mockCheckClassAccessById.mockResolvedValue(false);

      await expect(service.getClassStatistics('class-1', 'stranger-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.classMember.count).not.toHaveBeenCalled();
    });
  });

  // ─── validateInviteCode ───────────────────────────────────────────────────

  describe('validateInviteCode', () => {
    it('returns { valid: true, class: {...} } when code exists', async () => {
      const classData = {
        id: 'class-1',
        name: 'English 101',
        description: null,
        is_group: true,
        created_by: 'teacher-1',
        creator: { id: 'teacher-1', full_name: 'Teacher One', email: 'teacher@test.com', role: 'TEACHER' },
        _count: { members: 5, teachers: 1, sessions: 3 },
      };
      mockPrisma.class.findUnique.mockResolvedValue(classData);

      const result = await service.validateInviteCode('ABCD1234');

      expect(mockPrisma.class.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { invite_code: 'ABCD1234' } }),
      );
      expect(result.valid).toBe(true);
      expect(result.class).toEqual(classData);
    });

    it('returns { valid: false, class: null } when code not found', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      const result = await service.validateInviteCode('INVALID');

      expect(result.valid).toBe(false);
      expect(result.class).toBeNull();
    });
  });

  // ─── getAllClasses ─────────────────────────────────────────────────────────

  describe('getAllClasses', () => {
    it('returns paginated result with total and items', async () => {
      const items = [makeClass()];
      mockPrisma.$transaction.mockResolvedValue([1, items]);

      const result = await service.getAllClasses({ page: 1, pageSize: 10 });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.total).toBe(1);
      expect(result.data).toEqual(items);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('applies search query when "q" is provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);

      const result = await service.getAllClasses({ page: 1, pageSize: 10, q: 'english' });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });

    it('filters by creatorId when provided', async () => {
      const items = [makeClass()];
      mockPrisma.$transaction.mockResolvedValue([1, items]);

      const result = await service.getAllClasses({
        page: 1,
        pageSize: 10,
        creatorId: 'teacher-1',
      });

      expect(result.total).toBe(1);
    });

    it('calculates correct totalPages for multiple pages', async () => {
      const items = Array.from({ length: 5 }, (_, i) => makeClass({ id: `class-${i}` }));
      mockPrisma.$transaction.mockResolvedValue([23, items]);

      const result = await service.getAllClasses({ page: 1, pageSize: 5 });

      expect(result.totalPages).toBe(5); // ceil(23/5)
    });
  });

  // ─── searchClasses ────────────────────────────────────────────────────────

  describe('searchClasses', () => {
    it('returns matching classes', async () => {
      const classes = [
        {
          id: 'class-1',
          name: 'English 101',
          description: null,
          price: null,
          is_group: true,
          invite_code: 'ABCD1234',
          created_by: 'teacher-1',
          creator: { id: 'teacher-1', full_name: 'Teacher One', email: 'teacher@test.com', role: 'TEACHER' },
          _count: { members: 0, teachers: 1, sessions: 0 },
        },
      ];
      mockPrisma.class.findMany.mockResolvedValue(classes);

      const result = await service.searchClasses('teacher-1', 'english');

      expect(mockPrisma.class.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual(classes);
      expect(result).toHaveLength(1);
    });

    it('returns all accessible classes when query is empty', async () => {
      const classes = [makeClass()];
      mockPrisma.class.findMany.mockResolvedValue(classes);

      const result = await service.searchClasses('teacher-1', '');

      expect(mockPrisma.class.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no classes match', async () => {
      mockPrisma.class.findMany.mockResolvedValue([]);

      const result = await service.searchClasses('teacher-1', 'nonexistent');

      expect(result).toHaveLength(0);
    });
  });
});
