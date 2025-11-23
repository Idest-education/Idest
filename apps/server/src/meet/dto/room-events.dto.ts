export class UserJoinedDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  role: string;
  socketId: string;
}

export class UserLeftDto {
  sessionId: string;
  userId: string;
  socketId: string;
}

export class SessionParticipantsDto {
  sessionId: string;
  participants: Array<{
    userId: string;
    userFullName: string;
    userAvatar?: string;
    role: string;
    socketId: string;
    isOnline: boolean;
  }>;
}

export class ScreenShareResponseDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  isSharing: boolean;
}

export class MediaToggleResponseDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  type: 'audio' | 'video';
  isEnabled: boolean;
}

export class ParticipantKickedDto {
  sessionId: string;
  targetUserId: string;
  kickedBy: string;
  kickedByFullName: string;
}

export class ParticipantMediaStoppedDto {
  sessionId: string;
  targetUserId: string;
  mediaType: 'audio' | 'video' | 'both';
  stoppedBy: string;
  stoppedByFullName: string;
}

export class RecordingStartedDto {
  sessionId: string;
  startedBy: string;
  startedByFullName: string;
  timestamp: Date;
}

export class RecordingStoppedDto {
  sessionId: string;
  stoppedBy: string;
  stoppedByFullName: string;
  recordingUrl?: string;
  timestamp: Date;
}
