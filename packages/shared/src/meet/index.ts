// --- Join Room ---

export interface IJoinRoom {
  sessionId: string;
  token: string;
}

// --- LiveKit Token Response ---

export interface ILiveKitCredentials {
  url: string;
  roomName: string;
  accessToken: string;
}

export interface ILiveKitTokenResponse {
  sessionId: string;
  livekit: ILiveKitCredentials;
}

// --- Chat Messages ---

export interface IChatMessage {
  sessionId: string;
  message: string;
}

export interface IChatMessageResponse {
  sessionId: string;
  message: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  timestamp: Date;
}

// --- Media Controls ---

export interface IStartScreenShare {
  sessionId: string;
  streamId?: string;
}

export interface IStopScreenShare {
  sessionId: string;
}

export interface IToggleMedia {
  sessionId: string;
  type: 'audio' | 'video';
  isEnabled: boolean;
}

// --- Message History ---

export interface IGetMeetingMessages {
  sessionId: string;
  limit?: number;
  before?: string;
}

export interface IGetClassroomMessages {
  classId: string;
  limit?: number;
  before?: string;
}

export interface IMessageHistoryResponse {
  id: string;
  content: string;
  sentAt: Date;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface IMessageHistoryList {
  messages: IMessageHistoryResponse[];
  hasMore: boolean;
  total: number;
}

// --- Room Events ---

export interface IUserJoined {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  role: string;
  socketId: string;
}

export interface IUserLeft {
  sessionId: string;
  userId: string;
  socketId: string;
}

export interface ISessionParticipant {
  userId: string;
  userFullName: string;
  userAvatar?: string;
  role: string;
  socketId: string;
  isOnline: boolean;
}

export interface ISessionParticipants {
  sessionId: string;
  participants: ISessionParticipant[];
}

export interface IScreenShareResponse {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  isSharing: boolean;
}

export interface IMediaToggleResponse {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string;
  type: 'audio' | 'video';
  isEnabled: boolean;
}

export interface IParticipantKicked {
  sessionId: string;
  targetUserId: string;
  kickedBy: string;
  kickedByFullName: string;
}

export interface IParticipantMediaStopped {
  sessionId: string;
  targetUserId: string;
  mediaType: 'audio' | 'video' | 'both';
  stoppedBy: string;
  stoppedByFullName: string;
}

export interface IRecordingStarted {
  sessionId: string;
  startedBy: string;
  startedByFullName: string;
  timestamp: Date;
}

export interface IRecordingStopped {
  sessionId: string;
  stoppedBy: string;
  stoppedByFullName: string;
  recordingUrl?: string;
  timestamp: Date;
}
