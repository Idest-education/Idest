"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { Room, RoomEvent, Track, RemoteParticipant, LocalParticipant, RemoteTrack, RemoteTrackPublication, DisconnectReason } from "livekit-client";
import { connectMeetSocket, disconnectMeetSocket } from "@/lib/meet-socket";
import { getUserMedia, stopMediaStream, toggleAudioTrack, toggleVideoTrack } from "@/services/webrtc.service";
import {
  Participant,
  ChatMessageResponse,
  MessageHistoryResponse,
  JoinRoomSuccessResponse,
  UserJoinedDto,
  UserLeftDto,
  SessionParticipantsDto,
  ErrorResponse,
  ScreenShareResponseDto,
  ScreenShareErrorDto,
  MediaToggleResponseDto,
  MediaToggleErrorDto,
  SessionEndedDto,
  AttendeeCountUpdatedDto,
  LiveKitCredentials,
} from "@/types/meet";
import { http } from "@/services/http";

export interface UseMeetingReturn {
  // connection state
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
  
  // media state
  localStream: MediaStream | null;
  localScreenShareStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isScreenShareLoading: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  
  // participants
  participants: Participant[];
  localParticipant: Participant | null;
  
  // messages
  messages: ChatMessageResponse[];
  messageHistory: MessageHistoryResponse[];
  
  // remote streams (userId -> MediaStream)
  remoteStreams: Map<string, MediaStream>;
  
  // remote screen share streams (userId -> MediaStream)
  remoteScreenShareStreams: Map<string, MediaStream>;
  
  // actions
  joinRoom: (sessionId: string, token: string) => Promise<void>;
  leaveRoom: (sessionId: string) => void;
  sendMessage: (sessionId: string, message: string) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  loadMessageHistory: (sessionId: string, limit?: number, before?: string) => void;
}

// Helper to parse LiveKit participant metadata
function parseParticipantMetadata(participant: RemoteParticipant | LocalParticipant): {
  sessionId?: string;
  userId?: string;
  role?: string;
  email?: string;
  avatarUrl?: string;
} {
  try {
    if (participant.metadata) {
      return JSON.parse(participant.metadata);
    }
  } catch (e) {
    console.warn("Failed to parse participant metadata:", e);
  }
  return {};
}

// Helper to get user ID from participant
function getParticipantUserId(participant: RemoteParticipant | LocalParticipant): string | null {
  const metadata = parseParticipantMetadata(participant);
  return metadata.userId || participant.identity || null;
}

// Helper to check if JWT token is expired
function isTokenExpired(token: string): boolean {
  try {
    // Simple JWT decode without library (just parse payload)
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false; // No expiry
    
    const now = Math.floor(Date.now() / 1000);
    // Add 60s buffer
    return payload.exp < now + 60;
  } catch {
    return true; // Can't decode = assume expired
  }
}

// Helper to create message dedupe key
function createMessageDedupeKey(chatData: ChatMessageResponse): string {
  // Use message ID if available (most reliable)
  if (chatData.id) {
    return chatData.id;
  }
  
  // Fallback: Create hash from full content to avoid collisions
  const timestamp = new Date(chatData.timestamp).toISOString();
  const content = `${timestamp}-${chatData.userId}-${chatData.message}`;
  
  // Simple hash (for browser, no crypto needed)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `msg_${Math.abs(hash).toString(36)}`;
}

function cloneStreamWithTracks(sourceStream: MediaStream | undefined, extraTrack?: MediaStreamTrack): MediaStream {
  const newStream = new MediaStream();

  if (sourceStream) {
    sourceStream.getTracks().forEach((track) => {
      if (!newStream.getTracks().some((t) => t.id === track.id)) {
        newStream.addTrack(track);
      }
    });
  }

  if (extraTrack && !newStream.getTracks().some((t) => t.id === extraTrack.id)) {
    newStream.addTrack(extraTrack);
  }

  return newStream;
}

function cloneStreamWithoutTrack(sourceStream: MediaStream | undefined, trackToRemove: MediaStreamTrack): MediaStream | null {
  if (!sourceStream) {
    return null;
  }

  const newStream = new MediaStream();
  sourceStream.getTracks().forEach((track) => {
    if (track.id !== trackToRemove.id) {
      newStream.addTrack(track);
    }
  });

  return newStream.getTracks().length > 0 ? newStream : null;
}

export function useMeeting(): UseMeetingReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenShareStream, setLocalScreenShareStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isScreenShareLoading, setIsScreenShareLoading] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageHistoryResponse[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteScreenShareStreams, setRemoteScreenShareStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const liveKitRoomRef = useRef<Room | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareTrackRef = useRef<MediaStreamTrack | null>(null);
  const joinRoomInProgressRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const currentTokenRef = useRef<string | null>(null);
  const liveKitCredentialsRef = useRef<LiveKitCredentials | null>(null);
  // Track processed message IDs with timestamp for LRU eviction
  const processedMessageIdsRef = useRef<Map<string, number>>(new Map());
  const MAX_DEDUPE_ENTRIES = 500;
  const DEDUPE_EXPIRY_MS = 60000;
  // Ref for LiveKit reconnection handler to avoid circular dependency
  const handleLiveKitReconnectionRef = useRef<(() => Promise<void>) | null>(null);
  // Flag to prevent multiple simultaneous reconnection attempts
  const isReconnectingRef = useRef<boolean>(false);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);
  // Debounce refs for media toggles
  const audioToggleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoToggleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize local media stream
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err: unknown) {
      console.error("Failed to get user media:", err);
      
      let errorMessage = "Failed to access camera/microphone.";
      
      if (err && typeof err === 'object' && 'name' in err) {
        const errorName = (err as { name: string }).name;
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          errorMessage = "Camera/microphone access denied. Please grant permissions and refresh the page.";
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          errorMessage = "No camera or microphone found. Please connect a device and try again.";
        } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
          errorMessage = "Camera/microphone is already in use by another application.";
        } else if (errorName === "OverconstrainedError") {
          errorMessage = "Camera/microphone doesn't support the required settings.";
        }
      }
      
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Setup LiveKit room event handlers
  const setupLiveKitRoomHandlers = useCallback((room: Room) => {
    // Handle remote participant connected
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      try {
        console.log("LiveKit participant connected:", participant.identity);
        const userId = getParticipantUserId(participant);
        const metadata = parseParticipantMetadata(participant);
        
        if (userId && userId !== currentUserIdRef.current) {
          if (!isMountedRef.current) return;
          setParticipants((prev) => {
            if (prev.find((p) => p.userId === userId)) return prev;
            return [
              ...prev,
              {
                userId,
                userFullName: participant.name || metadata.email || userId,
                userAvatar: metadata.avatarUrl,
                role: (metadata.role as "student" | "teacher" | "admin") || "student",
                socketId: "", // LiveKit doesn't use socket IDs
                isOnline: true,
              },
            ];
          });
        }
      } catch (err) {
        console.error("Error handling participant connection:", err, {
          participantId: participant?.identity,
        });
      }
    });

    // Handle remote participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      try {
        console.log("LiveKit participant disconnected:", participant.identity);
        const userId = getParticipantUserId(participant);
        
        if (userId && isMountedRef.current) {
          setParticipants((prev) => prev.filter((p) => p.userId !== userId));
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
          setRemoteScreenShareStreams((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }
      } catch (err) {
        console.error("Error handling participant disconnection:", err, {
          participantId: participant?.identity,
        });
      }
    });

    // Handle track subscribed (remote tracks)
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      try {
        console.log("LiveKit track subscribed:", track.kind, "from", participant.identity);
        const userId = getParticipantUserId(participant);
        
        if (!userId) return;
        if (!isMountedRef.current) return;

        // Attach track to DOM element or create MediaStream
        if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
          // Check if it's a screen share track
          if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
            setRemoteScreenShareStreams((prev) => {
              const next = new Map(prev);
              const existingStream = next.get(userId);
              const updatedStream = cloneStreamWithTracks(existingStream, track.mediaStreamTrack);
              next.set(userId, updatedStream);

              console.log(
                `${existingStream ? 'Added' : 'Created'} ${track.kind} track for screen share stream ${userId}. Total tracks: ${updatedStream.getTracks().length}`,
              );

              return next;
            });
            // Update participant screen sharing state
            setParticipants((prev) =>
              prev.map((p) =>
                p.userId === userId ? { ...p, isScreenSharing: true } : p
              )
            );
          } else {
            // Regular camera/microphone track
            setRemoteStreams((prev) => {
              const next = new Map(prev);
              const existingStream = next.get(userId);
              const updatedStream = cloneStreamWithTracks(existingStream, track.mediaStreamTrack);
              next.set(userId, updatedStream);

              console.log(
                `${existingStream ? 'Added' : 'Created'} ${track.kind} track for stream ${userId}. Total tracks: ${updatedStream.getTracks().length}`,
              );

              return next;
            });
          }
        }
      } catch (err) {
        console.error("Error handling track subscription:", err, {
          trackKind: track?.kind,
          participantId: participant?.identity,
        });
        // Optionally set error state
        if (isMountedRef.current) {
          setError("Failed to receive participant video. Please refresh if issues persist.");
        }
      }
    });

    // Handle track unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      try {
        console.log("LiveKit track unsubscribed:", track.kind, "from", participant.identity);
        const userId = getParticipantUserId(participant);
        
        if (!userId) return;
        if (!isMountedRef.current) return;

        if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
          setRemoteScreenShareStreams((prev) => {
            const next = new Map(prev);
            const existingStream = next.get(userId);
            
            if (existingStream) {
              const updatedStream = cloneStreamWithoutTrack(existingStream, track.mediaStreamTrack);
              
              if (updatedStream) {
                next.set(userId, updatedStream);
                console.log(
                  `Removed ${track.kind} track from screen share stream for ${userId}. Remaining tracks: ${updatedStream.getTracks().length}`,
                );
              } else {
                next.delete(userId);
                console.log(`Removed empty screen share stream for ${userId}`);
              }
            }
            
            return next;
          });
          
          // Update participant screen sharing state only if no more screen share tracks
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === userId ? { ...p, isScreenSharing: false } : p
            )
          );
        } else {
          // Regular camera/microphone track
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            const existingStream = next.get(userId);
            
            if (existingStream) {
              const updatedStream = cloneStreamWithoutTrack(existingStream, track.mediaStreamTrack);
              
              if (updatedStream) {
                next.set(userId, updatedStream);
                console.log(
                  `Removed ${track.kind} track from stream for ${userId}. Remaining tracks: ${updatedStream.getTracks().length}`,
                );
              } else {
                next.delete(userId);
                console.log(`Removed empty stream for ${userId}`);
              }
            }
            
            return next;
          });
        }
      } catch (err) {
        console.error("Error handling track unsubscription:", err, {
          trackKind: track?.kind,
          participantId: participant?.identity,
        });
      }
    });

    // Handle data received (chat, screen-share events)
    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);
        
        // Validate structure
        if (!data.type || !data.payload || !data.sessionId) {
          console.warn("Invalid LiveKit data packet structure:", data);
          return;
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log("LiveKit data received:", data.type);
        }
        
        if (data.type === 'chat-message') {
          const chatData = data.payload as ChatMessageResponse;
          
          // Validate chat payload
          if (!chatData.userId || !chatData.message || !chatData.timestamp) {
            console.warn("Invalid chat message payload:", chatData);
            return;
          }
          
          // Create dedupe key using improved hash
          const messageId = createMessageDedupeKey(chatData);
          
          // Check if already processed (with timestamp for expiry)
          const now = Date.now();
          if (processedMessageIdsRef.current.has(messageId)) {
            if (process.env.NODE_ENV === 'development') {
              console.log("Skipping duplicate chat message from LiveKit");
            }
            return;
          }

          // Add to dedupe map with timestamp
          processedMessageIdsRef.current.set(messageId, now);
          
          // Prune old entries (LRU-style)
          if (processedMessageIdsRef.current.size > MAX_DEDUPE_ENTRIES) {
            // Remove entries older than DEDUPE_EXPIRY_MS
            for (const [key, timestamp] of processedMessageIdsRef.current.entries()) {
              if (now - timestamp > DEDUPE_EXPIRY_MS) {
                processedMessageIdsRef.current.delete(key);
              }
            }
            
            // If still too large, remove oldest entries
            if (processedMessageIdsRef.current.size > MAX_DEDUPE_ENTRIES) {
              const entries = Array.from(processedMessageIdsRef.current.entries());
              entries.sort((a, b) => a[1] - b[1]);
              const toRemove = entries.slice(0, entries.length - MAX_DEDUPE_ENTRIES);
              toRemove.forEach(([key]) => processedMessageIdsRef.current.delete(key));
            }
          }
          
          // Normalize timestamp to string
          const normalizedChat = {
            ...chatData,
            timestamp: new Date(chatData.timestamp).toISOString(),
          };
          
          // Add to messages if not already present
          if (!isMountedRef.current) return;
          
          setMessages((prev) => {
            // Double-check for duplicates in existing messages
            const exists = prev.some(
              (m) =>
                m.userId === normalizedChat.userId &&
                m.message === normalizedChat.message &&
                Math.abs(new Date(m.timestamp).getTime() - new Date(normalizedChat.timestamp).getTime()) < 1000
            );
            if (exists) {
              return prev;
            }
            return [...prev, normalizedChat];
          });
        } else if (data.type === 'screen-share-started') {
          const screenShareData = data.payload as ScreenShareResponseDto;
          if (!isMountedRef.current) return;
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === screenShareData.userId ? { ...p, isScreenSharing: true } : p
            )
          );
        } else if (data.type === 'screen-share-stopped') {
          const screenShareData = data.payload as ScreenShareResponseDto;
          if (!isMountedRef.current) return;
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === screenShareData.userId ? { ...p, isScreenSharing: false } : p
            )
          );
        }
      } catch (err) {
        console.error("Error processing LiveKit data:", err);
      }
    });

    // Handle room disconnect/reconnect
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      console.log("LiveKit room disconnected:", reason);
      
      if (!isMountedRef.current) return;
      setIsConnected(false);
      
      // Don't reconnect if:
      // 1. Client initiated the disconnect (user left)
      // 2. Already reconnecting
      // 3. Room is already connected (might be a race condition)
      // 4. No session ID available
      if (
        reason === DisconnectReason.CLIENT_INITIATED ||
        isReconnectingRef.current ||
        room.state === 'connected' ||
        !currentSessionIdRef.current
      ) {
        console.log("Skipping reconnection:", {
          reason,
          isReconnecting: isReconnectingRef.current,
          roomState: room.state,
          hasSessionId: !!currentSessionIdRef.current,
        });
        return;
      }
      
      // For connection errors, try to get fresh credentials immediately
      if (reason === DisconnectReason.JOIN_FAILURE || !liveKitCredentialsRef.current) {
        console.log("Connection error or no credentials, will request fresh token");
      }
      
      // LiveKit has built-in reconnection, but if it fails, we'll manually reconnect
      // Wait a bit to see if LiveKit reconnects automatically
      setTimeout(() => {
        // Only manually reconnect if room is still disconnected and we're not already reconnecting
        if (room.state !== 'connected' && !isReconnectingRef.current && handleLiveKitReconnectionRef.current) {
          console.log("LiveKit auto-reconnect failed, attempting manual reconnection");
          handleLiveKitReconnectionRef.current();
        }
      }, 3000); // Wait 3 seconds for LiveKit's automatic reconnection
    });

    room.on(RoomEvent.Reconnecting, () => {
      console.log("LiveKit room reconnecting...");
      setError("Reconnecting to meeting...");
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log("LiveKit room reconnected");
      if (!isMountedRef.current) return;
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false; // Reset reconnection flag
    });

    // Handle connection quality changes
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      try {
        // Only track local participant's quality
        if (participant === room.localParticipant) {
          if (process.env.NODE_ENV === 'development') {
            console.log("Local connection quality:", quality);
          }
          
          if (!isMountedRef.current) return;
          
          // Map LiveKit ConnectionQuality enum to simplified state
          // ConnectionQuality: Excellent = "excellent", Good = "good", Poor = "poor", Unknown = "unknown" (string values)
          const qualityStr = String(quality).toLowerCase();
          
          if (qualityStr.includes('excellent') || qualityStr === 'excellent') {
            setConnectionQuality('excellent');
          } else if (qualityStr.includes('good') || qualityStr === 'good') {
            setConnectionQuality('good');
          } else if (qualityStr.includes('poor') || qualityStr === 'poor') {
            setConnectionQuality('poor');
          } else {
            setConnectionQuality('unknown');
          }
        }
      } catch (err) {
        console.error("Error handling connection quality change:", err);
      }
    });
  }, []);

  // Handle LiveKit reconnection
  const handleLiveKitReconnection = useCallback(async () => {
    // Prevent multiple simultaneous reconnection attempts
    if (isReconnectingRef.current) {
      console.log("Reconnection already in progress, skipping");
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError("Failed to reconnect to meeting after multiple attempts. Please refresh the page.");
      isReconnectingRef.current = false;
      return;
    }

    // Check if room is already connected
    const room = liveKitRoomRef.current;
    if (room && room.state === 'connected') {
      console.log("Room already connected, skipping reconnection");
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    isReconnectingRef.current = true;
    reconnectAttemptsRef.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 5000);
    
    setError(`Connection lost. Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        if (!currentSessionIdRef.current) {
          throw new Error("No session ID available for reconnection");
        }

        const currentRoom = liveKitRoomRef.current;
        if (!currentRoom) {
          throw new Error("Room not available for reconnection");
        }

        // Check again if room is already connected (might have reconnected automatically)
        if (currentRoom.state === 'connected') {
          console.log("Room reconnected automatically, skipping manual reconnection");
          setIsConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          isReconnectingRef.current = false;
          return;
        }

        let livekit: LiveKitCredentials | null = null;

        // Try to get fresh token from REST endpoint first
        try {
          const response = await http.get(`/meet/${currentSessionIdRef.current}/livekit-token`);
          
          // Handle both wrapped and unwrapped responses
          const responseData = response.data || response;
          
          // Check if response has the expected structure
          if (responseData && responseData.livekit) {
            const credentials = responseData.livekit;
            
            // Validate livekit credentials structure
            if (credentials.url && credentials.accessToken && credentials.roomName) {
              livekit = credentials;
              liveKitCredentialsRef.current = livekit;
              console.log("Got fresh LiveKit credentials from API");
            } else {
              console.warn("Invalid credentials structure from API:", credentials);
            }
          } else {
            console.warn("Unexpected response structure:", responseData);
          }
        } catch (apiErr) {
          console.warn("Failed to get fresh token from API, trying stored credentials:", apiErr);
        }

        // Fall back to stored credentials if API call failed
        if (!livekit && liveKitCredentialsRef.current) {
          const storedCreds = liveKitCredentialsRef.current;
          
          // Check if stored token is expired
          if (!isTokenExpired(storedCreds.accessToken)) {
            livekit = storedCreds;
            console.log("Using stored LiveKit credentials for reconnection");
          } else {
            console.warn("Stored LiveKit token expired, cannot reconnect");
            throw new Error("LiveKit token expired. Please rejoin the meeting.");
          }
        }

        // Validate we have credentials
        if (!livekit || !livekit.url || !livekit.accessToken) {
          throw new Error("No valid LiveKit credentials available for reconnection");
        }

        // Reconnect to LiveKit room
        await currentRoom.connect(livekit.url, livekit.accessToken);
        console.log("Successfully reconnected to LiveKit room");
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        isReconnectingRef.current = false;
      } catch (err) {
        console.error("Failed to reconnect to LiveKit:", err);
        isReconnectingRef.current = false;
        if (handleLiveKitReconnectionRef.current) {
          handleLiveKitReconnectionRef.current(); // Retry
        }
      }
    }, delay);
  }, []);
  
  // Update ref when callback changes
  handleLiveKitReconnectionRef.current = handleLiveKitReconnection;

  // Setup socket listeners (for presence, chat sending, screen-share state)
  const setupSocketListeners = useCallback(
    (socket: Socket, sessionId: string) => {
      socket.off("join-room-success");
      socket.off("join-room-error");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("session-participants");
      socket.off("chat-message");
      socket.off("message-history");
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("screen-share-error");
      socket.off("media-toggled");
      socket.off("media-toggle-error");
      socket.off("session-ended");
      socket.off("attendee-count-updated");
      socket.off("disconnect");
      socket.off("connect_error");
      
      // Join success - initialize LiveKit connection
      socket.on("join-room-success", async (data: JoinRoomSuccessResponse) => {
        // Check if we're already connected (prevent duplicate joins from Fast Refresh)
        if (liveKitRoomRef.current && liveKitRoomRef.current.state === 'connected') {
          console.log("Already connected to LiveKit, ignoring duplicate join-room-success");
          return;
        }
        
        currentUserIdRef.current = data.userId;
        liveKitCredentialsRef.current = data.livekit;
        
        let room: Room | null = null;
        
        try {
          // Connect to LiveKit room
          const { Room } = await import("livekit-client");
          room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });
          
          setupLiveKitRoomHandlers(room);
          liveKitRoomRef.current = room;
          
          let tracksPublished = false;
          let isPublishingTracks = false;
          
          // Set up a one-time listener for when room is fully connected
          const publishTracks = async () => {
            // Prevent double publishing
            if (tracksPublished || isPublishingTracks) {
              console.log("Tracks already published or publishing in progress");
              return;
            }
            
            // Safety check for room
            if (!room) {
              console.error("Room is null, cannot publish tracks");
              return;
            }
            
            isPublishingTracks = true;
            
            try {
              // Publish local tracks
              const localStream = localStreamRef.current;
              if (localStream && room) {
                // Check and publish audio track with timeout
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && audioTrack.readyState === 'live') {
                  // Check if track is already published
                  const existingAudioPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
                  if (!existingAudioPub) {
                    try {
                      await Promise.race([
                        room.localParticipant.publishTrack(audioTrack, {
                          source: Track.Source.Microphone,
                        }),
                        new Promise((_, reject) => 
                          setTimeout(() => reject(new Error('Audio track publish timeout')), 10000)
                        )
                      ]);
                      console.log("Published audio track");
                    } catch (audioErr) {
                      console.error("Failed to publish audio track:", audioErr);
                      // Don't throw - continue with video
                    }
                  }
                }
                
                // Check and publish video track with timeout
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack && videoTrack.readyState === 'live') {
                  // Check if track is already published
                  const existingVideoPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                  if (!existingVideoPub) {
                    try {
                      await Promise.race([
                        room.localParticipant.publishTrack(videoTrack, {
                          source: Track.Source.Camera,
                        }),
                        new Promise((_, reject) => 
                          setTimeout(() => reject(new Error('Video track publish timeout')), 10000)
                        )
                      ]);
                      console.log("Published video track");
                    } catch (videoErr) {
                      console.error("Failed to publish video track:", videoErr);
                      // Continue anyway
                    }
                  }
                }
              }
              
              tracksPublished = true;
            } catch (publishErr) {
              console.error("Error publishing tracks:", publishErr);
              // Don't fail the entire connection if track publishing fails
            } finally {
              isPublishingTracks = false;
            }
          };
          
          // Listen for connected event before setting state (ensures tracks are published first)
          room.once(RoomEvent.Connected, async () => {
            if (!room) return;
            console.log("LiveKit room fully connected:", room.name);
            
            // Add delay to ensure room is fully ready before publishing
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
              await publishTracks();
            } catch (publishErr) {
              console.error("Failed to publish tracks on connect:", publishErr);
              // Continue anyway - user can manually enable later
            }
            
            // NOW set connected state (after tracks published)
            if (!isMountedRef.current) return;
            setIsConnected(true);
            setIsJoining(false);
            joinRoomInProgressRef.current = false;

            // Request participants from Socket.IO (for presence/roster)
            socket.emit("get-session-participants", sessionId);
          });
          
          // Connect to LiveKit with timeout
          const connectTimeout = setTimeout(() => {
            console.error("LiveKit connection timeout after 15 seconds");
            throw new Error("LiveKit connection timeout");
          }, 15000);
          
          try {
            await room.connect(data.livekit.url, data.livekit.accessToken);
            clearTimeout(connectTimeout);
            console.log("LiveKit connect() completed, waiting for Connected event");
          } catch (connectErr) {
            clearTimeout(connectTimeout);
            throw connectErr;
          }
          
        } catch (err) {
          console.error("Failed to connect to LiveKit:", err);
          
          // Cleanup LiveKit room if it exists
          if (room) {
            try {
              await room.disconnect();
            } catch (disconnectErr) {
              console.warn("Error disconnecting orphaned room:", disconnectErr);
            }
            liveKitRoomRef.current = null;
          }
          
          // Cleanup socket
          if (socketRef.current) {
            socketRef.current.removeAllListeners();
            disconnectMeetSocket();
            socketRef.current = null;
          }
          
          if (!isMountedRef.current) return;
          setError(err instanceof Error ? err.message : "Failed to connect to meeting");
          setIsJoining(false);
          joinRoomInProgressRef.current = false;
        }
      });

      // Join error
      socket.on("join-room-error", (error: ErrorResponse) => {
        console.error("Join room error:", error);
        const errorMessage = error.message || error.details || "Failed to join room";
        setError(errorMessage);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;
        
        if (socketRef.current) {
          disconnectMeetSocket();
        }
      });

      // User joined (Socket.IO presence)
      socket.on("user-joined", (data: UserJoinedDto) => {
        const isSelfByUserId = data.userId === currentUserIdRef.current;
        const isSelfBySocketId = socketRef.current && data.socketId === socketRef.current.id;
        
        if (isSelfByUserId || isSelfBySocketId) {
          setLocalParticipant({
            userId: data.userId,
            userFullName: data.userFullName,
            userAvatar: data.userAvatar,
            role: data.role,
            socketId: data.socketId,
            isOnline: true,
          });
        } else {
          setParticipants((prev) => {
            if (prev.find((p) => p.userId === data.userId)) return prev;
            return [
              ...prev,
              {
                userId: data.userId,
                userFullName: data.userFullName,
                userAvatar: data.userAvatar,
                role: data.role,
                socketId: data.socketId,
                isOnline: true,
              },
            ];
          });
        }
      });

      // User left (Socket.IO presence)
      socket.on("user-left", (data: UserLeftDto) => {
        setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
      });

      // Session participants (Socket.IO presence)
      socket.on("session-participants", (data: SessionParticipantsDto) => {
        const currentUserId = currentUserIdRef.current;
        const currentSocketId = socketRef.current?.id;
        
        let local = currentUserId
          ? data.participants.find((p) => p.userId === currentUserId)
          : undefined;
        if (!local && currentSocketId) {
          local = data.participants.find((p) => p.socketId === currentSocketId);
        }
        const remote = data.participants.filter((p) => {
          if (local) return p.userId !== local.userId;
          if (currentUserId) return p.userId !== currentUserId;
          if (currentSocketId) return p.socketId !== currentSocketId;
          return true;
        });

        if (local) {
          setLocalParticipant(local);
        }
        setParticipants(remote);
      });

      // Chat message (Socket.IO - for deduplication and DB persistence echo)
      socket.on("chat-message", (data: ChatMessageResponse) => {
        // Create dedupe key using improved hash
        const messageId = createMessageDedupeKey(data);
        
        // Check if already processed from LiveKit
        const now = Date.now();
        if (processedMessageIdsRef.current.has(messageId)) {
          if (process.env.NODE_ENV === 'development') {
            console.log("Skipping duplicate chat message from Socket.IO");
          }
          return;
        }
        
        // Add to dedupe map with timestamp
        processedMessageIdsRef.current.set(messageId, now);
        
        // Prune old entries (same logic as LiveKit handler)
        if (processedMessageIdsRef.current.size > MAX_DEDUPE_ENTRIES) {
          for (const [key, timestamp] of processedMessageIdsRef.current.entries()) {
            if (now - timestamp > DEDUPE_EXPIRY_MS) {
              processedMessageIdsRef.current.delete(key);
            }
          }
          
          if (processedMessageIdsRef.current.size > MAX_DEDUPE_ENTRIES) {
            const entries = Array.from(processedMessageIdsRef.current.entries());
            entries.sort((a, b) => a[1] - b[1]);
            const toRemove = entries.slice(0, entries.length - MAX_DEDUPE_ENTRIES);
            toRemove.forEach(([key]) => processedMessageIdsRef.current.delete(key));
          }
        }
        
        // Normalize timestamp and add message
        const normalizedData = {
          ...data,
          timestamp: new Date(data.timestamp).toISOString(),
        };
        
        if (!isMountedRef.current) return;
        setMessages((prev) => [...prev, normalizedData]);
      });

      // Message history
      socket.on("message-history", (data: { messages: MessageHistoryResponse[]; hasMore: boolean; total: number }) => {
        setMessageHistory(data.messages);
      });

      // Screen share started (Socket.IO - for UI state)
      socket.on("screen-share-started", (data: ScreenShareResponseDto) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId ? { ...p, isScreenSharing: true } : p
          )
        );
      });

      // Screen share stopped (Socket.IO - for UI state)
      socket.on("screen-share-stopped", (data: ScreenShareResponseDto) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId ? { ...p, isScreenSharing: false } : p
          )
        );
      });

      // Screen share error
      socket.on("screen-share-error", (data: ScreenShareErrorDto) => {
        console.error("Screen share error:", data.message);
        setError(data.message);
      });

      // Media toggled (Socket.IO presence)
      socket.on("media-toggled", (data: MediaToggleResponseDto) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId
              ? {
                  ...p,
                  isAudioEnabled: data.type === "audio" ? data.isEnabled : p.isAudioEnabled,
                  isVideoEnabled: data.type === "video" ? data.isEnabled : p.isVideoEnabled,
                }
              : p
          )
        );
      });

      // Media toggle error
      socket.on("media-toggle-error", (data: MediaToggleErrorDto) => {
        console.error("Media toggle error:", data.message);
        setError(data.message);
      });

      // Session ended
      socket.on("session-ended", (data: SessionEndedDto) => {
        console.log("Session ended:", data);
        setError(data.message || "The session has ended.");
        
        setTimeout(() => {
          if (currentSessionIdRef.current === data.sessionId) {
            window.location.href = "/sessions";
          }
        }, 3000);
      });

      // Attendee count updated
      socket.on("attendee-count-updated", (data: AttendeeCountUpdatedDto) => {
        console.log(`Attendee count updated for session ${data.sessionId}: ${data.count}`);
      });

      // Connection errors
      socket.on("disconnect", (reason) => {
        setIsConnected(false);
        
        if (reason === "io server disconnect") {
          setError("Disconnected by server. The session may have ended.");
        } else if (reason === "io client disconnect") {
          console.log("Client disconnected");
        } else {
          console.log("Unexpected disconnect");
        }
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        if (!isMountedRef.current) return;
        setError(`Connection error: ${err.message}`);
      });

      // Handle socket reconnection
      socket.on("reconnect", (attemptNumber) => {
        console.log("Socket.IO reconnected after", attemptNumber, "attempts");
        
        // Re-join the room to restore presence
        if (currentSessionIdRef.current && currentTokenRef.current) {
          console.log("Re-joining room after Socket.IO reconnection");
          socket.emit("join-room", { 
            sessionId: currentSessionIdRef.current, 
            token: currentTokenRef.current 
          });
        }
        
        if (!isMountedRef.current) return;
        setError(null); // Clear any connection errors
      });

      socket.on("reconnect_failed", () => {
        console.error("Socket.IO reconnection failed after all attempts");
        if (!isMountedRef.current) return;
        setError("Failed to reconnect to server. Please refresh the page.");
      });

      socket.on("reconnect_error", (err) => {
        console.error("Socket.IO reconnection error:", err);
      });
    },
    [setupLiveKitRoomHandlers]
  );

  // Join room
  const joinRoom = useCallback(
    async (sessionId: string, token: string) => {
      // Use ref as single source of truth BEFORE any checks
      if (joinRoomInProgressRef.current) {
        console.log("Join already in progress");
        return;
      }
      
      // Set flag immediately (synchronous)
      joinRoomInProgressRef.current = true;
      
      // Secondary validation
      if (isConnected) {
        console.warn("Already connected, aborting join");
        joinRoomInProgressRef.current = false;
        return;
      }
      
      // Check for unmount
      if (!isMountedRef.current) {
        console.warn("Component unmounted, aborting join");
        joinRoomInProgressRef.current = false;
        return;
      }
      
      setIsJoining(true);
      setError(null);
      currentSessionIdRef.current = sessionId;
      currentTokenRef.current = token;
      processedMessageIdsRef.current.clear();

      try {
        console.log("Starting to join room:", sessionId);
        
        // Get local stream first
        console.log("Getting user media...");
        await initializeLocalStream();
        console.log("User media obtained");

        // Connect socket
        console.log("Connecting socket...");
        const socket = connectMeetSocket(token);
        socketRef.current = socket;

        // Wait for connection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error("Connection timeout after 10s");
            reject(new Error("Connection timeout after 10 seconds"));
          }, 10000);

          const cleanup = () => {
            clearTimeout(timeout);
            socket.off("connect", onConnect);
            socket.off("connect_error", onError);
            socket.off("disconnect", onDisconnect);
          };

          const onConnect = () => {
            console.log("Socket connected, setting up listeners");
            cleanup();
            resolve();
          };

          const onError = (err: Error) => {
            console.error("Socket connection error:", err);
            cleanup();
            reject(err);
          };

          const onDisconnect = (reason: string) => {
            console.error("Socket disconnected before join:", reason);
            if (reason === "io server disconnect") {
              cleanup();
              reject(new Error("Server disconnected: " + reason));
            }
          };

          socket.once("connect", onConnect);
          socket.once("connect_error", onError);
          socket.on("disconnect", onDisconnect);

          if (socket.connected) {
            console.log("Socket already connected");
            cleanup();
            resolve();
          }
        });

        console.log("Socket connected, setting up listeners");
        setupSocketListeners(socket, sessionId);

        // Join room (will trigger LiveKit connection in join-room-success handler)
        console.log("Emitting join-room event");
        socket.emit("join-room", { sessionId, token });
      } catch (err) {
        console.error("Error joining room:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to join meeting";
        
        if (!isMountedRef.current) {
          console.warn("Component unmounted during join error handling");
          joinRoomInProgressRef.current = false;
          if (socketRef.current) {
            disconnectMeetSocket();
            socketRef.current = null;
          }
          return;
        }
        
        setError(errorMessage);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;
        
        if (socketRef.current) {
          disconnectMeetSocket();
          socketRef.current = null;
        }
      }
    },
    [isConnected, initializeLocalStream, setupSocketListeners]
  );

  // Leave room
  const leaveRoom = useCallback((sessionId: string) => {
    joinRoomInProgressRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    // Disconnect LiveKit room
    const room = liveKitRoomRef.current;
    if (room) {
      room.disconnect();
      liveKitRoomRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.emit("leave-room", sessionId);
      socketRef.current.removeAllListeners();
      disconnectMeetSocket();
      socketRef.current = null;
    }

    // Stop local streams
    if (localStreamRef.current) {
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
    }
    
    if (screenShareTrackRef.current) {
      screenShareTrackRef.current.stop();
      screenShareTrackRef.current = null;
    }

    // Reset state
    setIsConnected(false);
    setIsJoining(false);
    setParticipants([]);
    setLocalParticipant(null);
    setMessages([]);
    setMessageHistory([]);
    setRemoteStreams(new Map());
    setRemoteScreenShareStreams(new Map());
    setLocalStream(null);
    setLocalScreenShareStream(null);
    setIsScreenSharing(false);
    currentSessionIdRef.current = null;
    currentUserIdRef.current = null;
    currentTokenRef.current = null;
    liveKitCredentialsRef.current = null;
    reconnectAttemptsRef.current = 0;
    isReconnectingRef.current = false;
    processedMessageIdsRef.current.clear();
  }, []);

  // Send message (via Socket.IO for DB persistence)
  const sendMessage = useCallback((sessionId: string, message: string) => {
    if (socketRef.current && message.trim()) {
      socketRef.current.emit("chat-message", { sessionId, message });
    }
  }, []);

  // Toggle audio with debounce
  const toggleAudio = useCallback(() => {
    // Clear existing timeout
    if (audioToggleTimeoutRef.current) {
      clearTimeout(audioToggleTimeoutRef.current);
    }

    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);

    // Debounce the actual toggle operation
    audioToggleTimeoutRef.current = setTimeout(async () => {
      // Update LiveKit track - just mute/unmute, don't unpublish
      const room = liveKitRoomRef.current;
      if (room && room.state === 'connected') {
        try {
          const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          if (publication) {
            // Use LiveKit's built-in mute/unmute
            if (newState) {
              await publication.unmute();
            } else {
              await publication.mute();
            }
            console.log(`Audio ${newState ? 'unmuted' : 'muted'}`);
          }
        } catch (err) {
          console.error("Error toggling audio track in LiveKit:", err);
        }
      }

      // Also update the underlying MediaStreamTrack for local preview
      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream) {
        toggleAudioTrack(currentLocalStream, newState);
      }

      // Emit socket event for presence
      if (socketRef.current && currentSessionIdRef.current) {
        socketRef.current.emit("toggle-media", {
          sessionId: currentSessionIdRef.current,
          type: "audio",
          isEnabled: newState,
        });
      }
      
      audioToggleTimeoutRef.current = null;
    }, 300); // 300ms debounce
  }, [isAudioEnabled]);

  // Toggle video with debounce
  const toggleVideo = useCallback(() => {
    // Clear existing timeout
    if (videoToggleTimeoutRef.current) {
      clearTimeout(videoToggleTimeoutRef.current);
    }

    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);

    // Debounce the actual toggle operation
    videoToggleTimeoutRef.current = setTimeout(async () => {
      // Update LiveKit track - just mute/unmute, don't unpublish
      const room = liveKitRoomRef.current;
      if (room && room.state === 'connected') {
        try {
          const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (publication) {
            // Use LiveKit's built-in mute/unmute
            if (newState) {
              await publication.unmute();
            } else {
              await publication.mute();
            }
            console.log(`Video ${newState ? 'unmuted' : 'muted'}`);
          }
        } catch (err) {
          console.error("Error toggling video track in LiveKit:", err);
        }
      }

      // Also update the underlying MediaStreamTrack for local preview
      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream) {
        toggleVideoTrack(currentLocalStream, newState);
      }

      // Emit socket event for presence
      if (socketRef.current && currentSessionIdRef.current) {
        socketRef.current.emit("toggle-media", {
          sessionId: currentSessionIdRef.current,
          type: "video",
          isEnabled: newState,
        });
      }
      
      videoToggleTimeoutRef.current = null;
    }, 300); // 300ms debounce
  }, [isVideoEnabled]);

  // Toggle screen share (using LiveKit APIs)
  const toggleScreenShare = useCallback(async () => {
    // Prevent multiple simultaneous operations
    if (isScreenShareLoading) {
      console.log("Screen share operation in progress");
      return;
    }
    
    setIsScreenShareLoading(true);
    
    try {
      const room = liveKitRoomRef.current;
      if (!room || room.state !== 'connected') {
        throw new Error("Not connected to meeting");
      }

      if (isScreenSharing) {
        // Stop screen sharing
        const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (publication && publication.track) {
          await room.localParticipant.unpublishTrack(publication.track);
          publication.track.stop();
        }
        
        screenShareTrackRef.current = null;
        setLocalScreenShareStream(null);
        setIsScreenSharing(false);

        // Emit socket event for backend/UI state
        if (socketRef.current && currentSessionIdRef.current) {
          socketRef.current.emit("stop-screen-share", {
            sessionId: currentSessionIdRef.current,
          });
        }
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          await room.localParticipant.publishTrack(screenTrack, {
            source: Track.Source.ScreenShare,
          });
          
          // Store the MediaStreamTrack for cleanup
          screenShareTrackRef.current = screenTrack;
          setLocalScreenShareStream(screenStream);
        setIsScreenSharing(true);

          // Emit socket event for backend/UI state
        if (socketRef.current && currentSessionIdRef.current) {
          socketRef.current.emit("start-screen-share", {
            sessionId: currentSessionIdRef.current,
          });
        }

          // Stop screen share when user stops sharing via browser button
          screenTrack.onended = async () => {
            // Check if room is still valid
            const currentRoom = liveKitRoomRef.current;
            if (!currentRoom || currentRoom.state !== 'connected') {
              console.warn("Room disconnected, skipping screen share cleanup");
              screenShareTrackRef.current = null;
              setLocalScreenShareStream(null);
              setIsScreenSharing(false);
              return;
            }
            
            // Check if this is still the active screen share track
            if (screenShareTrackRef.current !== screenTrack) {
              console.log("Different screen share active, ignoring onended");
              return;
            }
            
            const publication = currentRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare);
            if (publication && publication.track) {
              try {
                await currentRoom.localParticipant.unpublishTrack(publication.track);
              } catch (err) {
                console.error("Error unpublishing screen share on track end:", err);
              }
            }
            
            screenShareTrackRef.current = null;
            if (isMountedRef.current) {
              setLocalScreenShareStream(null);
              setIsScreenSharing(false);
            }

            if (socketRef.current?.connected && currentSessionIdRef.current) {
              socketRef.current.emit("stop-screen-share", {
                sessionId: currentSessionIdRef.current,
              });
            }
          };
        }
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to toggle screen share");
      }
    } finally {
      if (isMountedRef.current) {
        setIsScreenShareLoading(false);
      }
    }
  }, [isScreenSharing, isScreenShareLoading]);

  // Load message history
  const loadMessageHistory = useCallback((sessionId: string, limit = 50, before?: string) => {
    if (socketRef.current) {
      socketRef.current.emit("get-message-history", {
        sessionId,
        limit,
        before,
      });
    }
  }, []);

  // Track mounted state to prevent updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSessionIdRef.current) {
        leaveRoom(currentSessionIdRef.current);
      }
    };
  }, [leaveRoom]);

  return {
    isConnected,
    isJoining,
    error,
    localStream,
    localScreenShareStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isScreenShareLoading,
    connectionQuality,
    participants,
    localParticipant,
    messages,
    messageHistory,
    remoteStreams,
    remoteScreenShareStreams,
    joinRoom,
    leaveRoom,
    sendMessage,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    loadMessageHistory,
  };
}
