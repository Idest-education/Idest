// Request DTOs
export interface JoinRoomDto {
  sessionId: string;
  token: string;
}

export interface ChatMessageDto {
  sessionId: string;
  message: string;
}

export interface WebRTCOfferDto {
  sessionId: string;
  targetUserId: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerDto {
  sessionId: string;
  targetUserId: string;
  answer: RTCSessionDescriptionInit;
}

export interface ICECandidateDto {
  sessionId: string;
  targetUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface GetMeetingMessagesDto {
  sessionId: string;
  limit?: number;
  before?: string;
}

// Response DTOs
export interface JoinRoomSuccessResponse {
  sessionId: string;
  userId: string;
  message: string;
}

export interface ChatMessageResponse {
  sessionId: string;
  message: string;
  userId: string;
  userFullName: string;
  userAvatar?: string | null;
  timestamp: string;
}

export interface UserJoinedDto {
  sessionId: string;
  userId: string;
  userFullName: string;
  userAvatar?: string | null;
  role: "student" | "teacher" | "admin";
  socketId: string;
}

export interface UserLeftDto {
  sessionId: string;
  userId: string;
  socketId: string;
}

export interface Participant {
  userId: string;
  userFullName: string;
  userAvatar?: string | null;
  role: "student" | "teacher" | "admin";
  socketId: string;
  isOnline: boolean;
}

export interface SessionParticipantsDto {
  sessionId: string;
  participants: Participant[];
}

export interface MessageHistoryResponse {
  id: string;
  content: string;
  sentAt: string;
  sender: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  };
}

export interface MessageHistoryListDto {
  messages: MessageHistoryResponse[];
  hasMore: boolean;
  total: number;
}

export interface WebRTCOfferResponse {
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerResponse {
  sessionId: string;
  fromUserId: string;
  fromUserName: string;
  answer: RTCSessionDescriptionInit;
}

export interface ICECandidateResponse {
  sessionId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface ErrorResponse {
  message: string;
  details?: string;
}

