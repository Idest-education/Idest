export interface LiveKitCredentials {
  url: string;
  roomName: string;
  accessToken: string;
}

export interface MeetParticipant {
  userId: string;
  userFullName: string;
  userAvatar?: string;
  role: string;
  socketId: string;
  isOnline: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing?: boolean;
}

export interface MeetChatMessageSender {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export interface MeetChatMessage {
  id: string;
  sessionId: string;
  content: string;
  sentAt: string;
  sender: MeetChatMessageSender;
}

export interface JoinRoomPayload {
  sessionId: string;
  token: string;
}

export interface ChatMessagePayload {
  sessionId: string;
  message: string;
}

export interface MessageHistoryRequest {
  sessionId: string;
  limit?: number;
  before?: string;
}

export interface ToggleMediaPayload {
  sessionId: string;
  type: "audio" | "video";
  isEnabled: boolean;
}

export interface ScreenSharePayload {
  sessionId: string;
  streamId?: string;
}

export interface MeetState {
  // Connection state
  sessionId: string | null;
  isSocketConnected: boolean;
  isLiveKitConnected: boolean;
  isJoining: boolean;
  livekitCredentials: LiveKitCredentials | null;
  localUserId: string | null;

  // Media state
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  activeScreenSharer: string | null;

  // Participants
  participants: Record<string, MeetParticipant>;

  // Chat
  messages: MeetChatMessage[];
  hasMoreMessages: boolean;
  isLoadingMessages: boolean;

  // UI state
  showChat: boolean;
  showParticipants: boolean;

  // Errors / status
  error: string | null;
  lastUpdatedAt: number;
}


