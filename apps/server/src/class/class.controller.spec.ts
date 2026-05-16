import { Test, TestingModule } from '@nestjs/testing';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';
import { AuthGuard } from 'src/common/guard/auth.guard';
import { RolesGuard } from 'src/common/guard/role.guard';

const mockClassService = {
  createClass: jest.fn(),
  getUserClasses: jest.fn(),
  updateClass: jest.fn(),
  deleteClass: jest.fn(),
  addStudent: jest.fn(),
  removeStudent: jest.fn(),
  addTeacher: jest.fn(),
  removeTeacher: jest.fn(),
  joinClass: jest.fn(),
  leaveClass: jest.fn(),
  getClassMembers: jest.fn(),
  getClassTeachers: jest.fn(),
  getClassStatistics: jest.fn(),
  searchClasses: jest.fn(),
  getCalendarEventsForUser: jest.fn(),
  getClassBySlug: jest.fn(),
  getAllClasses: jest.fn(),
  regenerateInviteCode: jest.fn(),
  validateInviteCode: jest.fn(),
  updateClassSettings: jest.fn(),
  bulkAddStudents: jest.fn(),
  bulkRemoveStudents: jest.fn(),
  getClassById: jest.fn(),
};

const user = {
  id: 'user-1',
  email: 'user@test.com',
  full_name: 'User One',
  role: 'TEACHER',
};

describe('ClassController', () => {
  let controller: ClassController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassController],
      providers: [{ provide: ClassService, useValue: mockClassService }],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = module.get<ClassController>(ClassController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createClass', () => {
    it('delegates to ClassService.createClass', async () => {
      const dto = { name: 'IELTS 101', is_group: false };
      const expected = { id: 'class-1', name: 'IELTS 101' };
      mockClassService.createClass.mockResolvedValue(expected);

      const result = await controller.createClass(user as any, dto as any);

      expect(mockClassService.createClass).toHaveBeenCalledWith(user, dto);
      expect(result).toBe(expected);
    });
  });

  describe('getUserClasses', () => {
    it('delegates to ClassService.getUserClasses with user.id', async () => {
      const expected = {
        created: [],
        teaching: [],
        enrolled: [],
      };
      mockClassService.getUserClasses.mockResolvedValue(expected);

      const result = await controller.getUserClasses(user as any);

      expect(mockClassService.getUserClasses).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });
  });

  describe('updateClass', () => {
    it('delegates to ClassService.updateClass', async () => {
      const classId = 'class-1';
      const dto = { name: 'Updated Name' };
      const expected = { id: 'class-1', name: 'Updated Name' };
      mockClassService.updateClass.mockResolvedValue(expected);

      const result = await controller.updateClass(classId, user as any, dto as any);

      expect(mockClassService.updateClass).toHaveBeenCalledWith(
        classId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('deleteClass', () => {
    it('delegates to ClassService.deleteClass', async () => {
      const classId = 'class-1';
      mockClassService.deleteClass.mockResolvedValue(undefined);

      const result = await controller.deleteClass(classId, user as any);

      expect(mockClassService.deleteClass).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('addStudent', () => {
    it('delegates to ClassService.addStudent', async () => {
      const classId = 'class-1';
      const dto = { student_id: 'student-1' };
      const expected = { id: 'class-1' };
      mockClassService.addStudent.mockResolvedValue(expected);

      const result = await controller.addStudent(classId, user as any, dto as any);

      expect(mockClassService.addStudent).toHaveBeenCalledWith(
        classId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('removeStudent', () => {
    it('delegates to ClassService.removeStudent', async () => {
      const classId = 'class-1';
      const studentId = 'student-1';
      mockClassService.removeStudent.mockResolvedValue(true);

      const result = await controller.removeStudent(
        classId,
        studentId,
        user as any,
      );

      expect(mockClassService.removeStudent).toHaveBeenCalledWith(
        classId,
        user.id,
        studentId,
      );
      expect(result).toBe(true);
    });
  });

  describe('addTeacher', () => {
    it('delegates to ClassService.addTeacher', async () => {
      const classId = 'class-1';
      const dto = { teacher_id: 'teacher-1' };
      const expected = { id: 'class-1' };
      mockClassService.addTeacher.mockResolvedValue(expected);

      const result = await controller.addTeacher(classId, user as any, dto as any);

      expect(mockClassService.addTeacher).toHaveBeenCalledWith(
        classId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('removeTeacher', () => {
    it('delegates to ClassService.removeTeacher', async () => {
      const classId = 'class-1';
      const teacherId = 'teacher-1';
      const expected = { id: 'class-1' };
      mockClassService.removeTeacher.mockResolvedValue(expected);

      const result = await controller.removeTeacher(
        classId,
        teacherId,
        user as any,
      );

      expect(mockClassService.removeTeacher).toHaveBeenCalledWith(
        classId,
        user.id,
        teacherId,
      );
      expect(result).toBe(expected);
    });
  });

  describe('joinClass', () => {
    it('delegates to ClassService.joinClass with user.id and invite_code', async () => {
      const dto = { invite_code: 'CODE123' };
      const expected = { id: 'class-1' };
      mockClassService.joinClass.mockResolvedValue(expected);

      const result = await controller.joinClass(user as any, dto as any);

      expect(mockClassService.joinClass).toHaveBeenCalledWith(
        'user-1',
        'CODE123',
      );
      expect(result).toBe(expected);
    });
  });

  describe('leaveClass', () => {
    it('delegates to ClassService.leaveClass', async () => {
      const classId = 'class-1';
      mockClassService.leaveClass.mockResolvedValue(true);

      const result = await controller.leaveClass(classId, user as any);

      expect(mockClassService.leaveClass).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBe(true);
    });
  });

  describe('getClassMembers', () => {
    it('delegates to ClassService.getClassMembers', async () => {
      const classId = 'class-1';
      const expected = [{ id: 'student-1', full_name: 'Alice' }];
      mockClassService.getClassMembers.mockResolvedValue(expected);

      const result = await controller.getClassMembers(classId, user as any);

      expect(mockClassService.getClassMembers).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBe(expected);
    });
  });

  describe('getClassTeachers', () => {
    it('delegates to ClassService.getClassTeachers', async () => {
      const classId = 'class-1';
      const expected = [{ id: 'teacher-1', full_name: 'Bob' }];
      mockClassService.getClassTeachers.mockResolvedValue(expected);

      const result = await controller.getClassTeachers(classId, user as any);

      expect(mockClassService.getClassTeachers).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBe(expected);
    });
  });

  describe('getClassStatistics', () => {
    it('delegates to ClassService.getClassStatistics', async () => {
      const classId = 'class-1';
      const expected = { members: 10, teachers: 2, sessions: 5 };
      mockClassService.getClassStatistics.mockResolvedValue(expected);

      const result = await controller.getClassStatistics(classId, user as any);

      expect(mockClassService.getClassStatistics).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBe(expected);
    });
  });

  describe('searchClasses', () => {
    it('delegates to ClassService.searchClasses with empty string when q is undefined', async () => {
      const expected = [{ id: 'class-1', name: 'IELTS' }];
      mockClassService.searchClasses.mockResolvedValue(expected);

      const result = await controller.searchClasses(user as any, undefined);

      expect(mockClassService.searchClasses).toHaveBeenCalledWith('user-1', '');
      expect(result).toBe(expected);
    });

    it('delegates to ClassService.searchClasses with provided q', async () => {
      const expected = [{ id: 'class-1', name: 'IELTS Prep' }];
      mockClassService.searchClasses.mockResolvedValue(expected);

      const result = await controller.searchClasses(user as any, 'IELTS');

      expect(mockClassService.searchClasses).toHaveBeenCalledWith(
        'user-1',
        'IELTS',
      );
      expect(result).toBe(expected);
    });
  });

  describe('getUserCalendarEvents', () => {
    it('delegates to ClassService.getCalendarEventsForUser with from and to', async () => {
      const query = { from: '2025-01-01', to: '2025-03-01' };
      const expected = { recurring: [], concrete: [] };
      mockClassService.getCalendarEventsForUser.mockResolvedValue(expected);

      const result = await controller.getUserCalendarEvents(user as any, query as any);

      expect(mockClassService.getCalendarEventsForUser).toHaveBeenCalledWith(
        'user-1',
        '2025-01-01',
        '2025-03-01',
      );
      expect(result).toBe(expected);
    });
  });

  describe('getClassBySlug', () => {
    it('delegates to ClassService.getClassBySlug', async () => {
      const slug = 'ielts-prep';
      const expected = { id: 'class-1', slug: 'ielts-prep' };
      mockClassService.getClassBySlug.mockResolvedValue(expected);

      const result = await controller.getClassBySlug(slug, user as any);

      expect(mockClassService.getClassBySlug).toHaveBeenCalledWith(
        slug,
        user.id,
      );
      expect(result).toBe(expected);
    });
  });

  describe('getAllClasses', () => {
    it('parses string params and calls service with correct defaults', async () => {
      const expected = { data: [], total: 0, page: 1, pageSize: 20 };
      mockClassService.getAllClasses.mockResolvedValue(expected);

      const result = await controller.getAllClasses('1', '20', undefined, 'updated_at', 'desc', undefined);

      expect(mockClassService.getAllClasses).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        q: undefined,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        creatorId: undefined,
      });
      expect(result).toBe(expected);
    });

    it('parses page and pageSize as integers', async () => {
      const expected = { data: [], total: 0, page: 2, pageSize: 50 };
      mockClassService.getAllClasses.mockResolvedValue(expected);

      const result = await controller.getAllClasses('2', '50', 'test', 'name', 'asc', 'creator-1');

      expect(mockClassService.getAllClasses).toHaveBeenCalledWith({
        page: 2,
        pageSize: 50,
        q: 'test',
        sortBy: 'name',
        sortOrder: 'asc',
        creatorId: 'creator-1',
      });
      expect(result).toBe(expected);
    });

    it('enforces pageSize max of 100', async () => {
      const expected = { data: [], total: 0, page: 1, pageSize: 100 };
      mockClassService.getAllClasses.mockResolvedValue(expected);

      const result = await controller.getAllClasses('1', '150', undefined, 'updated_at', 'desc', undefined);

      expect(mockClassService.getAllClasses).toHaveBeenCalledWith({
        page: 1,
        pageSize: 100,
        q: undefined,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        creatorId: undefined,
      });
      expect(result).toBe(expected);
    });

    it('enforces page minimum of 1', async () => {
      const expected = { data: [], total: 0, page: 1, pageSize: 20 };
      mockClassService.getAllClasses.mockResolvedValue(expected);

      const result = await controller.getAllClasses('0', '20', undefined, 'updated_at', 'desc', undefined);

      expect(mockClassService.getAllClasses).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        q: undefined,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        creatorId: undefined,
      });
      expect(result).toBe(expected);
    });
  });

  describe('getPublicClasses', () => {
    it('returns "unavailable" without calling service', async () => {
      const result = await controller.getPublicClasses();

      expect(result).toBe('unavailable');
      expect(mockClassService.getAllClasses).not.toHaveBeenCalled();
      expect(mockClassService.getClassBySlug).not.toHaveBeenCalled();
      expect(mockClassService.getUserClasses).not.toHaveBeenCalled();
    });
  });

  describe('regenerateInviteCode', () => {
    it('delegates to ClassService.regenerateInviteCode', async () => {
      const classId = 'class-1';
      const expected = 'NEWCODE2025';
      mockClassService.regenerateInviteCode.mockResolvedValue(expected);

      const result = await controller.regenerateInviteCode(classId, user as any);

      expect(mockClassService.regenerateInviteCode).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBe(expected);
    });
  });

  describe('validateInviteCode', () => {
    it('delegates to ClassService.validateInviteCode', async () => {
      const code = 'CODE123';
      const expected = { valid: true, class: { id: 'class-1' } };
      mockClassService.validateInviteCode.mockResolvedValue(expected);

      const result = await controller.validateInviteCode(code);

      expect(mockClassService.validateInviteCode).toHaveBeenCalledWith(code);
      expect(result).toBe(expected);
    });
  });

  describe('updateClassSettings', () => {
    it('delegates to ClassService.updateClassSettings', async () => {
      const classId = 'class-1';
      const dto = { is_group: true };
      const expected = { id: 'class-1', is_group: true };
      mockClassService.updateClassSettings.mockResolvedValue(expected);

      const result = await controller.updateClassSettings(
        classId,
        user as any,
        dto as any,
      );

      expect(mockClassService.updateClassSettings).toHaveBeenCalledWith(
        classId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('bulkAddStudents', () => {
    it('delegates to ClassService.bulkAddStudents', async () => {
      const classId = 'class-1';
      const dto = { student_ids: ['student-1', 'student-2'] };
      const expected = [
        { id: 'student-1', full_name: 'Alice' },
        { id: 'student-2', full_name: 'Bob' },
      ];
      mockClassService.bulkAddStudents.mockResolvedValue(expected);

      const result = await controller.bulkAddStudents(
        classId,
        user as any,
        dto as any,
      );

      expect(mockClassService.bulkAddStudents).toHaveBeenCalledWith(
        classId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('bulkRemoveStudents', () => {
    it('delegates to ClassService.bulkRemoveStudents', async () => {
      const classId = 'class-1';
      const dto = { student_ids: ['student-1', 'student-2'] };
      const expected = { count: 2 };
      mockClassService.bulkRemoveStudents.mockResolvedValue(expected);

      const result = await controller.bulkRemoveStudents(
        classId,
        user as any,
        dto as any,
      );

      expect(mockClassService.bulkRemoveStudents).toHaveBeenCalledWith(
        classId,
        user.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('getClassById', () => {
    it('delegates to ClassService.getClassById', async () => {
      const classId = 'class-1';
      const expected = { id: 'class-1', name: 'IELTS 101' };
      mockClassService.getClassById.mockResolvedValue(expected);

      const result = await controller.getClassById(classId, user as any);

      expect(mockClassService.getClassById).toHaveBeenCalledWith(
        classId,
        user.id,
      );
      expect(result).toBe(expected);
    });
  });
});
