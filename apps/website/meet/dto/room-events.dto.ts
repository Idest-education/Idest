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
