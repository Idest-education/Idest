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

export function useMeeting(): UseMeetingReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenShareStream, setLocalScreenShareStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
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
  // Track processed message IDs to prevent duplicates
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  // Ref for LiveKit reconnection handler to avoid circular dependency
  const handleLiveKitReconnectionRef = useRef<(() => Promise<void>) | null>(null);
  // Flag to prevent multiple simultaneous reconnection attempts
  const isReconnectingRef = useRef<boolean>(false);

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
      console.log("LiveKit participant connected:", participant.identity);
      const userId = getParticipantUserId(participant);
      const metadata = parseParticipantMetadata(participant);
      
      if (userId && userId !== currentUserIdRef.current) {
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
    });

    // Handle remote participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log("LiveKit participant disconnected:", participant.identity);
      const userId = getParticipantUserId(participant);
      
      if (userId) {
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
    });

    // Handle track subscribed (remote tracks)
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log("LiveKit track subscribed:", track.kind, "from", participant.identity);
      const userId = getParticipantUserId(participant);
      
      if (!userId) return;

      // Attach track to DOM element or create MediaStream
      if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
        const stream = new MediaStream([track.mediaStreamTrack]);
        
        // Check if it's a screen share track
        if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
          setRemoteScreenShareStreams((prev) => {
            const next = new Map(prev);
            next.set(userId, stream);
            return next;
          });
          // Update participant screen sharing state
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === userId ? { ...p, isScreenSharing: true } : p
            )
          );
        } else {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(userId, stream);
            return next;
          });
        }
      }
    });

    // Handle track unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log("LiveKit track unsubscribed:", track.kind, "from", participant.identity);
      const userId = getParticipantUserId(participant);
      
      if (!userId) return;

      if (publication.source === Track.Source.ScreenShare || publication.source === Track.Source.ScreenShareAudio) {
        setRemoteScreenShareStreams((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === userId ? { ...p, isScreenSharing: false } : p
          )
        );
      }
    });

    // Handle data received (chat, screen-share events)
    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data = JSON.parse(text);
        
        console.log("LiveKit data received:", data.type, data);
        
        if (data.type === 'chat-message') {
          const chatData = data.payload as ChatMessageResponse;
          
          // Create a unique ID for deduplication (use timestamp + userId + message content hash)
          const messageId = `${chatData.timestamp}-${chatData.userId}-${chatData.message.substring(0, 20)}`;
          
          // Skip if already processed
          if (processedMessageIdsRef.current.has(messageId)) {
            console.log("Skipping duplicate chat message from LiveKit:", messageId);
        return;
      }

          processedMessageIdsRef.current.add(messageId);
          
          // Add to messages (only if not from Socket.IO echo)
          setMessages((prev) => {
            // Check if message already exists (from Socket.IO)
            const exists = prev.some(
              (m) =>
                m.userId === chatData.userId &&
                m.message === chatData.message &&
                Math.abs(new Date(m.timestamp).getTime() - new Date(chatData.timestamp).getTime()) < 1000
            );
            if (exists) {
              console.log("Skipping duplicate chat message (already from Socket.IO)");
              return prev;
            }
            return [...prev, chatData];
          });
        } else if (data.type === 'screen-share-started') {
          const screenShareData = data.payload as ScreenShareResponseDto;
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === screenShareData.userId ? { ...p, isScreenSharing: true } : p
            )
          );
        } else if (data.type === 'screen-share-stopped') {
          const screenShareData = data.payload as ScreenShareResponseDto;
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
      setIsConnected(false);
      
      // Don't reconnect if:
      // 1. Client initiated the disconnect (user left)
      // 2. Already reconnecting
      // 3. Room is already connected (might be a race condition)
      // 4. No session ID or credentials available
      if (
        reason === DisconnectReason.CLIENT_INITIATED ||
        isReconnectingRef.current ||
        room.state === 'connected' ||
        !currentSessionIdRef.current ||
        !liveKitCredentialsRef.current
      ) {
        console.log("Skipping reconnection:", {
          reason,
          isReconnecting: isReconnectingRef.current,
          roomState: room.state,
          hasSessionId: !!currentSessionIdRef.current,
          hasCredentials: !!liveKitCredentialsRef.current,
        });
        return;
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
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false; // Reset reconnection flag
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
          
          // Check if response has the expected structure
          if (response.data && response.data.livekit) {
            const credentials = response.data.livekit;
            
            // Validate livekit credentials
            if (credentials.url && credentials.accessToken) {
              livekit = credentials;
              liveKitCredentialsRef.current = livekit;
              console.log("Got fresh LiveKit credentials from API");
            }
          }
        } catch (apiErr) {
          console.warn("Failed to get fresh token from API, trying stored credentials:", apiErr);
        }

        // Fall back to stored credentials if API call failed
        if (!livekit && liveKitCredentialsRef.current) {
          livekit = liveKitCredentialsRef.current;
          console.log("Using stored LiveKit credentials for reconnection");
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
        currentUserIdRef.current = data.userId;
        liveKitCredentialsRef.current = data.livekit;
        
        try {
          // Connect to LiveKit room
          const { Room } = await import("livekit-client");
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });
          
          setupLiveKitRoomHandlers(room);
          liveKitRoomRef.current = room;
          
          let tracksPublished = false;
          
          // Set up a one-time listener for when room is fully connected
          const publishTracks = async () => {
            // Prevent double publishing
            if (tracksPublished) {
              console.log("Tracks already published, skipping");
              return;
            }
            
            // Publish local tracks
            const localStream = localStreamRef.current;
            if (localStream) {
              try {
                // Check and publish audio track
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack && audioTrack.readyState === 'live') {
                  // Check if track is already published
                  const existingAudioPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
                  if (!existingAudioPub) {
                    await room.localParticipant.publishTrack(audioTrack, {
                      source: Track.Source.Microphone,
                    });
                    console.log("Published audio track");
                  } else {
                    console.log("Audio track already published");
                  }
                }
                
                // Check and publish video track
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack && videoTrack.readyState === 'live') {
                  // Check if track is already published
                  const existingVideoPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                  if (!existingVideoPub) {
                    await room.localParticipant.publishTrack(videoTrack, {
                      source: Track.Source.Camera,
                    });
                    console.log("Published video track");
                  } else {
                    console.log("Video track already published");
                  }
                }
                
                tracksPublished = true;
              } catch (publishErr) {
                console.error("Error publishing tracks:", publishErr);
                // Don't fail the entire connection if track publishing fails
              }
            }
          };
          
          // Listen for connected event before publishing (this ensures room is fully connected)
          room.once(RoomEvent.Connected, async () => {
            console.log("LiveKit room fully connected:", room.name);
            await publishTracks();
          });
          
          // Connect to LiveKit
          await room.connect(data.livekit.url, data.livekit.accessToken);
          console.log("LiveKit connect() completed, state:", room.state);
          
        setIsConnected(true);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;

          // Request participants from Socket.IO (for presence/roster)
        socket.emit("get-session-participants", sessionId);
        } catch (err) {
          console.error("Failed to connect to LiveKit:", err);
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
        // Create unique ID for deduplication
        const messageId = `${data.timestamp}-${data.userId}-${data.message.substring(0, 20)}`;
        
        // Skip if already processed from LiveKit
        if (processedMessageIdsRef.current.has(messageId)) {
          console.log("Skipping duplicate chat message from Socket.IO:", messageId);
          return;
        }
        
        processedMessageIdsRef.current.add(messageId);
        setMessages((prev) => [...prev, data]);
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
        setError(`Connection error: ${err.message}`);
      });
    },
    [setupLiveKitRoomHandlers]
  );

  // Join room
  const joinRoom = useCallback(
    async (sessionId: string, token: string) => {
      // Set flag immediately to prevent duplicate calls
      if (joinRoomInProgressRef.current || isJoining || isConnected) {
        console.log("Already joining or connected, skipping");
        return;
      }
      
      // Set flag before any async operations
      joinRoomInProgressRef.current = true;
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
        setError(errorMessage);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;
        
        if (socketRef.current) {
          disconnectMeetSocket();
        }
      }
    },
    [isJoining, isConnected, initializeLocalStream, setupSocketListeners]
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

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);

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
  }, [isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);

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
  }, [isVideoEnabled]);

  // Toggle screen share (using LiveKit APIs)
  const toggleScreenShare = useCallback(async () => {
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
            const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
            if (publication && publication.track) {
              await room.localParticipant.unpublishTrack(publication.track);
            }
            
            screenShareTrackRef.current = null;
            setLocalScreenShareStream(null);
          setIsScreenSharing(false);

          if (socketRef.current && currentSessionIdRef.current) {
            socketRef.current.emit("stop-screen-share", {
              sessionId: currentSessionIdRef.current,
            });
          }
        };
        }
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      setError(err instanceof Error ? err.message : "Failed to toggle screen share");
    }
  }, [isScreenSharing]);

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
