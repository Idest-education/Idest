import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/role.guard';

const mockService = {
  createSession: jest.fn(),
  getAllSessions: jest.fn(),
  getAllUserSessions: jest.fn(),
  getUserUpcomingSessions: jest.fn(),
  getSessionById: jest.fn(),
  updateSession: jest.fn(),
  endSession: jest.fn(),
  deleteSession: jest.fn(),
  getClassSessions: jest.fn(),
  recordAttendance: jest.fn(),
  recordLeave: jest.fn(),
  getSessionAttendance: jest.fn(),
  getUserAttendance: jest.fn(),
};

const user = {
  id: 'user-1',
  email: 'user@test.com',
  full_name: 'User One',
  role: 'TEACHER',
};

const pagination = { page: 1, limit: 20 };

describe('SessionController', () => {
  let controller: SessionController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [{ provide: SessionService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = module.get<SessionController>(SessionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createSession', () => {
    it('should call sessionService.createSession with user and dto', async () => {
      const dto = { class_id: 'class-1', start_time: '2025-01-01T10:00:00Z' };
      const expected = { id: 'session-1', class_id: 'class-1' };
      mockService.createSession.mockResolvedValue(expected);

      const result = await controller.createSession(user as any, dto as any);

      expect(mockService.createSession).toHaveBeenCalledWith(user, dto);
      expect(result).toBe(expected);
    });
  });

  describe('getAllSessions', () => {
    it('should call sessionService.getAllSessions with userId and pagination', async () => {
      const expected = {
        data: [{ id: 'session-1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.getAllSessions.mockResolvedValue(expected);

      const result = await controller.getAllSessions(user as any, pagination);

      expect(mockService.getAllSessions).toHaveBeenCalledWith(user.id, pagination);
      expect(result).toBe(expected);
    });
  });

  describe('getAllUserSessions', () => {
    it('should call sessionService.getAllUserSessions with userId and pagination', async () => {
      const expected = {
        data: [{ id: 'session-1' }, { id: 'session-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.getAllUserSessions.mockResolvedValue(expected);

      const result = await controller.getAllUserSessions(user as any, pagination);

      expect(mockService.getAllUserSessions).toHaveBeenCalledWith(user.id, pagination);
      expect(result).toBe(expected);
    });
  });

  describe('getUserUpcomingSessions', () => {
    it('should call sessionService.getUserUpcomingSessions with userId', async () => {
      const expected = [{ id: 'session-1' }, { id: 'session-2' }];
      mockService.getUserUpcomingSessions.mockResolvedValue(expected);

      const result = await controller.getUserUpcomingSessions(user as any);

      expect(mockService.getUserUpcomingSessions).toHaveBeenCalledWith(user.id);
      expect(result).toBe(expected);
    });
  });

  describe('getSessionById', () => {
    it('should call sessionService.getSessionById with sessionId and userId', async () => {
      const sessionId = 'session-1';
      const expected = { id: sessionId, class_id: 'class-1' };
      mockService.getSessionById.mockResolvedValue(expected);

      const result = await controller.getSessionById(sessionId, user as any);

      expect(mockService.getSessionById).toHaveBeenCalledWith(sessionId, user.id);
      expect(result).toBe(expected);
    });
  });

  describe('updateSession', () => {
    it('should return undefined and NOT call sessionService.updateSession', async () => {
      const sessionId = 'session-1';
      const dto = { start_time: '2025-01-01T11:00:00Z' };

      const result = await controller.updateSession(sessionId, user as any, dto as any);

      expect(mockService.updateSession).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('endSession', () => {
    it('should call sessionService.endSession with sessionId and userId', async () => {
      const sessionId = 'session-1';
      const expected = { id: sessionId, end_time: '2025-01-01T11:00:00Z' };
      mockService.endSession.mockResolvedValue(expected);

      const result = await controller.endSession(sessionId, user as any);

      expect(mockService.endSession).toHaveBeenCalledWith(sessionId, user.id);
      expect(result).toBe(expected);
    });
  });

  describe('deleteSession', () => {
    it('should call sessionService.deleteSession with sessionId and userId', async () => {
      const sessionId = 'session-1';
      mockService.deleteSession.mockResolvedValue(true);

      const result = await controller.deleteSession(sessionId, user as any);

      expect(mockService.deleteSession).toHaveBeenCalledWith(sessionId, user.id);
      expect(result).toBe(true);
    });
  });

  describe('getClassSessions', () => {
    it('should call sessionService.getClassSessions with classId, userId, and pagination', async () => {
      const classId = 'class-1';
      const expected = {
        data: [{ id: 'session-1' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.getClassSessions.mockResolvedValue(expected);

      const result = await controller.getClassSessions(classId, user as any, pagination);

      expect(mockService.getClassSessions).toHaveBeenCalledWith(classId, user.id, pagination);
      expect(result).toBe(expected);
    });
  });

  describe('recordAttendance', () => {
    it('should call sessionService.recordAttendance with sessionId and userId', async () => {
      const sessionId = 'session-1';
      const expected = { id: 'attendance-1', session_id: sessionId };
      mockService.recordAttendance.mockResolvedValue(expected);

      const result = await controller.recordAttendance(sessionId, user as any);

      expect(mockService.recordAttendance).toHaveBeenCalledWith(sessionId, user.id);
      expect(result).toBe(expected);
    });
  });

  describe('recordLeave', () => {
    it('should call sessionService.recordLeave with sessionId and userId, then return { success: true }', async () => {
      const sessionId = 'session-1';
      mockService.recordLeave.mockResolvedValue(undefined);

      const result = await controller.recordLeave(sessionId, user as any);

      expect(mockService.recordLeave).toHaveBeenCalledWith(sessionId, user.id);
      expect(result).toEqual({ success: true });
    });
  });

  describe('getSessionAttendance', () => {
    it('should call sessionService.getSessionAttendance with sessionId and userId', async () => {
      const sessionId = 'session-1';
      const expected = { session_id: sessionId, total_attendees: 5 };
      mockService.getSessionAttendance.mockResolvedValue(expected);

      const result = await controller.getSessionAttendance(sessionId, user as any);

      expect(mockService.getSessionAttendance).toHaveBeenCalledWith(sessionId, user.id);
      expect(result).toBe(expected);
    });
  });

  describe('getUserAttendance', () => {
    it('should call sessionService.getUserAttendance with userId and pagination', async () => {
      const expected = {
        data: [{ id: 'attendance-1' }, { id: 'attendance-2' }],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      };
      mockService.getUserAttendance.mockResolvedValue(expected);

      const result = await controller.getUserAttendance(user as any, pagination);

      expect(mockService.getUserAttendance).toHaveBeenCalledWith(user.id, pagination);
      expect(result).toBe(expected);
    });
  });
});
