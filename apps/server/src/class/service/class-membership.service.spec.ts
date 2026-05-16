import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClassMembershipService } from './class-membership.service';
import { PrismaService } from 'src/prisma/prisma.service';

const fullClassInclude = {
  id: 'class-1',
  name: 'English 101',
  slug: 'english-101',
  invite_code: 'ABCD1234',
  created_by: 'creator-1',
  description: null,
  is_group: true,
  price: null,
  schedule: null,
  creator: {
    id: 'creator-1',
    full_name: 'Creator',
    email: 'creator@test.com',
    role: 'TEACHER',
    avatar_url: null,
  },
  _count: { members: 1, teachers: 1, sessions: 0 },
  members: [],
  teachers: [],
  sessions: [],
};

const mockPrisma = {
  class: { findUnique: jest.fn() },
  classMember: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  classTeacher: {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  user: { findUnique: jest.fn(), update: jest.fn() },
  conversation: { findUnique: jest.fn(), create: jest.fn() },
  conversationParticipant: { createMany: jest.fn() },
  $transaction: jest.fn(),
};

describe('ClassMembershipService', () => {
  let service: ClassMembershipService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassMembershipService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClassMembershipService>(ClassMembershipService);
  });

  describe('addStudent', () => {
    it('adds a student when caller has management permission', async () => {
      // permission check
      mockPrisma.class.findUnique
        .mockResolvedValueOnce({ created_by: 'creator-1', teachers: [] })
        // class after student added
        .mockResolvedValueOnce(fullClassInclude);
      mockPrisma.classMember.findFirst.mockResolvedValue(null);
      mockPrisma.classMember.create.mockResolvedValue({});

      const result = await service.addStudent('class-1', 'creator-1', {
        student_id: 'student-1',
      } as any);
      expect(result).toBeDefined();
      expect(mockPrisma.classMember.create).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when caller is not creator or teacher', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'other', teachers: [] });

      await expect(
        service.addStudent('class-1', 'random-user', { student_id: 's1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when student is already a member', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });
      mockPrisma.classMember.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.addStudent('class-1', 'creator-1', { student_id: 's1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('addTeacher', () => {
    it('throws ForbiddenException when caller is not the creator', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-1', created_by: 'creator-1' });

      await expect(
        service.addTeacher('class-1', 'not-creator', { teacher_id: 't1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.addTeacher('bad-id', 'creator', { teacher_id: 't1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when teacher is already in the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-1', created_by: 'creator-1' });
      mockPrisma.classTeacher.findFirst.mockResolvedValue({ id: 'existing' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TEACHER' });

      await expect(
        service.addTeacher('class-1', 'creator-1', { teacher_id: 't1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('leaveClass', () => {
    it('removes a student who leaves the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-1', created_by: 'creator' });
      mockPrisma.classMember.findFirst.mockResolvedValue({ id: 'member-1' });
      mockPrisma.classMember.delete.mockResolvedValue({});

      const result = await service.leaveClass('class-1', 'student-1');
      expect(result).toBe(true);
      expect(mockPrisma.classMember.delete).toHaveBeenCalledWith({ where: { id: 'member-1' } });
    });

    it('removes a teacher who leaves the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-1', created_by: 'creator' });
      mockPrisma.classMember.findFirst.mockResolvedValue(null);
      mockPrisma.classTeacher.findFirst.mockResolvedValue({ id: 'ct-1' });
      mockPrisma.classTeacher.delete.mockResolvedValue({});

      const result = await service.leaveClass('class-1', 'teacher-1');
      expect(result).toBe(true);
    });

    it('throws ForbiddenException when the creator tries to leave', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-1', created_by: 'creator-1' });

      await expect(service.leaveClass('class-1', 'creator-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when user is not a member', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-1', created_by: 'creator' });
      mockPrisma.classMember.findFirst.mockResolvedValue(null);
      mockPrisma.classTeacher.findFirst.mockResolvedValue(null);

      await expect(service.leaveClass('class-1', 'nobody')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeStudent', () => {
    it('removes a student when caller has permission', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });
      mockPrisma.classMember.findFirst.mockResolvedValue({ id: 'cm-1' });
      mockPrisma.classMember.delete.mockResolvedValue({});

      const result = await service.removeStudent('class-1', 'creator-1', 'student-1');
      expect(result).toBe(true);
    });

    it('throws ForbiddenException without permission', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator', teachers: [] });

      await expect(
        service.removeStudent('class-1', 'outsider', 'student-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when student is not in the class', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });
      mockPrisma.classMember.findFirst.mockResolvedValue(null);

      await expect(
        service.removeStudent('class-1', 'creator-1', 'ghost'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkAddStudents', () => {
    it('skips students who are already members', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });
      mockPrisma.classMember.findMany.mockResolvedValue([{ student_id: 'already' }]);
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await service.bulkAddStudents('class-1', 'creator-1', {
        student_ids: ['already'],
      } as any);
      expect(result).toEqual([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns empty array when dto has no student IDs', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });

      const result = await service.bulkAddStudents('class-1', 'creator-1', {
        student_ids: [],
      } as any);
      expect(result).toEqual([]);
    });
  });

  describe('bulkRemoveStudents', () => {
    it('deletes the specified students and returns count', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });
      mockPrisma.classMember.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkRemoveStudents('class-1', 'creator-1', {
        student_ids: ['s1', 's2'],
      } as any);
      expect(result).toEqual({ count: 2 });
    });

    it('returns count 0 when student_ids is empty', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'creator-1', teachers: [] });

      const result = await service.bulkRemoveStudents('class-1', 'creator-1', {
        student_ids: [],
      } as any);
      expect(result).toEqual({ count: 0 });
    });
  });
});
