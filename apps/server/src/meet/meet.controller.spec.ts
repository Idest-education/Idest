import { Test, TestingModule } from '@nestjs/testing';
import { MeetController } from './meet.controller';
import { MeetService } from './meet.service';
import { AuthGuard } from 'src/common/guard/auth.guard';

const mockService = {
  validateSession: jest.fn(),
  validateUserSessionAccess: jest.fn(),
  getUserDetails: jest.fn(),
  prepareLiveKitCredentials: jest.fn(),
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
  listRecordings: jest.fn(),
  getRecordingUrl: jest.fn(),
};

const user = { id: 'user-1', email: 'user@test.com', full_name: 'User One', role: 'TEACHER' };
const sessionId = 'session-1';

describe('MeetController', () => {
  let controller: MeetController;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Set reasonable defaults
    mockService.validateSession.mockResolvedValue(true);
    mockService.validateUserSessionAccess.mockResolvedValue(true);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeetController],
      providers: [{ provide: MeetService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard).useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();
    controller = module.get<MeetController>(MeetController);
  });

  it('should be defined', () => { expect(controller).toBeDefined(); });

  describe('getLiveKitToken', () => {
    it('validates, fetches user details, prepares credentials, and returns token', async () => {
      const userDetails = { id: 'user-1', full_name: 'User One' };
      const livekitCreds = { url: 'wss://lk.test', roomName: 'session-1', token: 'jwt' };
      mockService.getUserDetails.mockResolvedValue(userDetails);
      mockService.prepareLiveKitCredentials.mockResolvedValue(livekitCreds);

      const result = await controller.getLiveKitToken(sessionId, user as any);

      expect(mockService.validateSession).toHaveBeenCalledWith(sessionId);
      expect(mockService.validateUserSessionAccess).toHaveBeenCalledWith(user.id, sessionId);
      expect(mockService.getUserDetails).toHaveBeenCalledWith(user.id);
      expect(mockService.prepareLiveKitCredentials).toHaveBeenCalledWith(user.id, sessionId, userDetails);
      expect(result).toEqual({ sessionId, livekit: livekitCreds });
    });
  });

  describe('startRecording', () => {
    it('validates session and returns egressId', async () => {
      mockService.startRecording.mockResolvedValue('egress-1');
      const result = await controller.startRecording(sessionId, user as any);
      expect(mockService.validateSession).toHaveBeenCalledWith(sessionId);
      expect(mockService.validateUserSessionAccess).toHaveBeenCalledWith(user.id, sessionId);
      expect(mockService.startRecording).toHaveBeenCalledWith(user.id, sessionId);
      expect(result).toEqual({ sessionId, egressId: 'egress-1' });
    });
  });

  describe('stopRecording', () => {
    it('validates session and returns stopped: true', async () => {
      mockService.stopRecording.mockResolvedValue(undefined);
      const result = await controller.stopRecording(sessionId, user as any);
      expect(mockService.stopRecording).toHaveBeenCalledWith(user.id, sessionId);
      expect(result).toEqual({ sessionId, stopped: true });
    });
  });

  describe('listRecordings', () => {
    it('returns recordings list', async () => {
      const items = [{ id: 'rec-1', url: 'https://...' }];
      mockService.listRecordings.mockResolvedValue(items);
      const result = await controller.listRecordings(sessionId, user as any);
      expect(mockService.validateUserSessionAccess).toHaveBeenCalledWith(user.id, sessionId);
      expect(mockService.listRecordings).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual({ sessionId, items });
    });
  });

  describe('getRecordingUrl', () => {
    it('fetches URL then validates access and returns url', async () => {
      mockService.getRecordingUrl.mockResolvedValue({ sessionId, url: 'https://...', location: 's3://bucket/file' });
      const result = await controller.getRecordingUrl('rec-1', user as any);
      expect(mockService.getRecordingUrl).toHaveBeenCalledWith('rec-1');
      expect(mockService.validateUserSessionAccess).toHaveBeenCalledWith(user.id, sessionId);
      expect(result).toEqual({ recordingId: 'rec-1', url: 'https://...', location: 's3://bucket/file' });
    });
  });
});
