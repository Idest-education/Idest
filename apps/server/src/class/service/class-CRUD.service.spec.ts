import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassCRUDService } from './class-CRUD.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/common/enum/role.enum';

const mockPrisma = {
  class: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  conversation: { create: jest.fn() },
  conversationParticipant: { create: jest.fn() },
  classTeacher: { create: jest.fn() },
  classMember: { create: jest.fn() },
};

const teacherUser = {
  id: 'teacher-1',
  email: 'teacher@test.com',
  full_name: 'Teacher One',
  role: Role.TEACHER,
};

const makeClass = (overrides = {}) => ({
  id: 'class-1',
  name: 'English 101',
  slug: 'english-101',
  invite_code: 'ABCD1234',
  created_by: 'teacher-1',
  creator: teacherUser,
  _count: { members: 0, teachers: 1, sessions: 0 },
  ...overrides,
});

describe('ClassCRUDService', () => {
  let service: ClassCRUDService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassCRUDService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClassCRUDService>(ClassCRUDService);
  });

  describe('createClass', () => {
    it('creates a class and its group conversation for a teacher', async () => {
      mockPrisma.class.findFirst.mockResolvedValue(null);
      mockPrisma.class.findUnique.mockResolvedValue(null);
      // slug generation: findFirst returns null
      const createdClass = makeClass();
      mockPrisma.class.create.mockResolvedValue(createdClass);
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversationParticipant.create.mockResolvedValue({});
      mockPrisma.classTeacher.create.mockResolvedValue({});

      const dto = { name: 'English 101', is_group: true };
      const result = await service.createClass(teacherUser as any, dto as any);

      expect(result).toEqual(createdClass);
      expect(mockPrisma.class.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.conversation.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.classTeacher.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when class name already exists', async () => {
      mockPrisma.class.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createClass(teacherUser as any, { name: 'Duplicate' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when provided invite code is already taken', async () => {
      mockPrisma.class.findFirst.mockResolvedValue(null);
      // findUnique for invite code check returns a hit
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'conflict' });

      await expect(
        service.createClass(teacherUser as any, { name: 'New Class', invite_code: 'TAKEN123' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateClass', () => {
    it('updates a class when it exists', async () => {
      const existing = makeClass();
      const updated = makeClass({ name: 'Updated' });
      mockPrisma.class.findUnique.mockResolvedValue(existing);
      mockPrisma.class.update.mockResolvedValue({
        ...updated,
        creator: teacherUser,
        _count: { members: 0, teachers: 1, sessions: 0 },
        members: [],
        teachers: [],
        sessions: [],
      });

      const result = await service.updateClass('class-1', 'teacher-1', { name: 'Updated' } as any);
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.updateClass('bad-id', 'teacher-1', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteClass', () => {
    it('deletes a class when the caller is the creator', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(makeClass());
      mockPrisma.class.delete.mockResolvedValue({});

      await expect(
        service.deleteClass('class-1', 'teacher-1'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.class.delete).toHaveBeenCalledWith({ where: { id: 'class-1' } });
    });

    it('throws NotFoundException when class does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);

      await expect(service.deleteClass('bad-id', 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not the creator', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(makeClass({ created_by: 'someone-else' }));

      await expect(
        service.deleteClass('class-1', 'teacher-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('regenerateInviteCode', () => {
    it('regenerates code when caller has management permission', async () => {
      // checkClassManagementPermission uses prisma.class.findUnique
      mockPrisma.class.findUnique
        .mockResolvedValueOnce({ created_by: 'teacher-1', teachers: [] }) // permission check
        .mockResolvedValueOnce(null); // unique code check
      mockPrisma.class.update.mockResolvedValue({ id: 'class-1', invite_code: 'NEWCODE1' });

      const code = await service.regenerateInviteCode('class-1', 'teacher-1');
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('throws ForbiddenException when caller lacks permission', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ created_by: 'other', teachers: [] });

      await expect(
        service.regenerateInviteCode('class-1', 'unauthorized'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
