import { Test, TestingModule } from '@nestjs/testing';
import { ClassService } from './class.service';
import { ClassCRUDService } from './service/class-CRUD.service';
import { ClassQueryService } from './service/class-query.service';
import { ClassMembershipService } from './service/class-membership.service';

const mockCRUD = {
  createClass: jest.fn(),
  updateClass: jest.fn(),
  regenerateInviteCode: jest.fn(),
  updateClassSettings: jest.fn(),
  deleteClass: jest.fn(),
};
const mockQuery = {
  getClassBySlug: jest.fn(),
  getUserClasses: jest.fn(),
  getClassById: jest.fn(),
  getClassMembers: jest.fn(),
  getClassTeachers: jest.fn(),
  getClassStatistics: jest.fn(),
  searchClasses: jest.fn(),
  getPublicClasses: jest.fn(),
  getCalendarEventsForUser: jest.fn(),
  getAllClasses: jest.fn(),
  validateInviteCode: jest.fn(),
};
const mockMembership = {
  addStudent: jest.fn(),
  addTeacher: jest.fn(),
  removeTeacher: jest.fn(),
  joinClass: jest.fn(),
  leaveClass: jest.fn(),
  removeStudent: jest.fn(),
  bulkAddStudents: jest.fn(),
  bulkRemoveStudents: jest.fn(),
};

describe('ClassService', () => {
  let service: ClassService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassService,
        { provide: ClassCRUDService, useValue: mockCRUD },
        { provide: ClassQueryService, useValue: mockQuery },
        { provide: ClassMembershipService, useValue: mockMembership },
      ],
    }).compile();
    service = module.get<ClassService>(ClassService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('delegates createClass to ClassCRUDService', async () => {
    const expected = { id: 'class-1' };
    mockCRUD.createClass.mockResolvedValue(expected);
    const result = await service.createClass({ id: 'u1' } as any, {} as any);
    expect(mockCRUD.createClass).toHaveBeenCalledWith({ id: 'u1' }, {});
    expect(result).toBe(expected);
  });

  it('delegates updateClass to ClassCRUDService', async () => {
    const expected = { id: 'class-1' };
    mockCRUD.updateClass.mockResolvedValue(expected);
    const result = await service.updateClass('class-1', 'u1', {} as any);
    expect(mockCRUD.updateClass).toHaveBeenCalledWith('class-1', 'u1', {});
    expect(result).toBe(expected);
  });

  it('delegates deleteClass to ClassCRUDService', async () => {
    mockCRUD.deleteClass.mockResolvedValue(undefined);
    await service.deleteClass('class-1', 'u1');
    expect(mockCRUD.deleteClass).toHaveBeenCalledWith('class-1', 'u1');
  });

  it('delegates getUserClasses to ClassQueryService', async () => {
    const expected = { created: [], teaching: [], enrolled: [] };
    mockQuery.getUserClasses.mockResolvedValue(expected);
    const result = await service.getUserClasses('u1');
    expect(mockQuery.getUserClasses).toHaveBeenCalledWith('u1');
    expect(result).toBe(expected);
  });

  it('delegates joinClass to ClassMembershipService', async () => {
    const expected = { id: 'class-1' };
    mockMembership.joinClass.mockResolvedValue(expected);
    const result = await service.joinClass('u1', 'INVITE1');
    expect(mockMembership.joinClass).toHaveBeenCalledWith('u1', 'INVITE1');
    expect(result).toBe(expected);
  });

  it('delegates bulkAddStudents to ClassMembershipService', async () => {
    const expected = [{ id: 's1' }];
    mockMembership.bulkAddStudents.mockResolvedValue(expected);
    const result = await service.bulkAddStudents('class-1', 'u1', { student_ids: ['s1'] } as any);
    expect(result).toBe(expected);
  });

  it('delegates getCalendarEventsForUser to ClassQueryService', async () => {
    const expected = { events: [] };
    mockQuery.getCalendarEventsForUser.mockResolvedValue(expected);
    const result = await service.getCalendarEventsForUser('u1', '2025-01-01', '2025-01-31');
    expect(mockQuery.getCalendarEventsForUser).toHaveBeenCalledWith('u1', '2025-01-01', '2025-01-31');
    expect(result).toBe(expected);
  });
});
