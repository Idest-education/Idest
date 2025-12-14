"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { createMeetSocket } from "@/lib/meet-socket";
import { useMeetStore } from "./useMeetStore";
import {
  ChatMessagePayload,
  LiveKitCredentials,
  MessageHistoryRequest,
  MeetChatMessage,
  MeetParticipant,
  ScreenSharePayload,
  ToggleMediaPayload,
  KickParticipantPayload,
  StopParticipantMediaPayload,
  StartRecordingPayload,
  StopRecordingPayload,
  ParticipantKickedEvent,
  ParticipantMediaStoppedEvent,
  RecordingStartedEvent,
  RecordingStoppedEvent,
} from "@/types/meet";
import { getLivekitToken } from "@/services/meet.service";
import { useRouter } from "next/navigation";

// Notification sound utility
let notificationAudio: HTMLAudioElement | null = null;
const playNotificationSound = () => {
  try {
    if (!notificationAudio) {
      // Try different possible paths for the notification sound
      const audioPath = "/assets/notification.mp3";
      notificationAudio = new Audio(audioPath);
      notificationAudio.volume = 0.7;
      notificationAudio.preload = "auto";
    }
    // Reset to start and play
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch((error) => {
      // Silently fail if autoplay is blocked
      console.warn("Failed to play notification sound:", error);
    });
  } catch (error) {
    console.warn("Failed to initialize notification sound:", error);
  }
};

interface UseMeetClientOptions {
  sessionId: string | null;
  autoJoin?: boolean;
}

export function useMeetClient({ sessionId, autoJoin = true }: UseMeetClientOptions) {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();

  const setSessionId = useMeetStore((state) => state.setSessionId);
  const setJoining = useMeetStore((state) => state.setJoining);
  const setSocketConnected = useMeetStore((state) => state.setSocketConnected);
  const setLiveKitConnected = useMeetStore((state) => state.setLiveKitConnected);
  const setLivekitCredentials = useMeetStore((state) => state.setLivekitCredentials);
  const setLocalUserId = useMeetStore((state) => state.setLocalUserId);
  const setParticipants = useMeetStore((state) => state.setParticipants);
  const upsertParticipant = useMeetStore((state) => state.upsertParticipant);
  const removeParticipant = useMeetStore((state) => state.removeParticipant);
  const addChatMessage = useMeetStore((state) => state.addChatMessage);
  const prependChatMessages = useMeetStore((state) => state.prependChatMessages);
  const setMessagesLoading = useMeetStore((state) => state.setMessagesLoading);
  const setParticipantMediaState = useMeetStore((state) => state.setParticipantMediaState);
  const setAudioEnabled = useMeetStore((state) => state.setAudioEnabled);
  const setVideoEnabled = useMeetStore((state) => state.setVideoEnabled);
  const setScreenSharing = useMeetStore((state) => state.setScreenSharing);
  const setActiveScreenSharer = useMeetStore((state) => state.setActiveScreenSharer);
  const setRecording = useMeetStore((state) => state.setRecording);
  const setError = useMeetStore((state) => state.setError);
  const reset = useMeetStore((state) => state.reset);
  const getStoreState = useMeetStore.getState;

  const cleanupSocket = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
      if (socket.connected) {
        socket.disconnect();
      }
    }
    socketRef.current = null;
    setSocketConnected(false);
  }, [setSocketConnected]);

  const leaveSession = useCallback(
    (emitLeave = true) => {
      const socket = socketRef.current;
      if (emitLeave && socket?.connected && sessionId) {
        socket.emit("leave-room", sessionId);
      }
      cleanupSocket();
      reset();
    },
    [cleanupSocket, reset, sessionId],
  );

  const handleJoinSuccess = useCallback(
    async (payload: {
      sessionId: string;
      userId: string;
      livekit: LiveKitCredentials;
    }) => {
      setSessionId(payload.sessionId);
      setLocalUserId(payload.userId);
      setLivekitCredentials(payload.livekit);
      setJoining(false);
      setError(null);
    },
    [setError, setJoining, setLivekitCredentials, setLocalUserId, setSessionId],
  );

  const bindSocketEvents = useCallback(
    (socket: Socket, sessionIdValue: string, token: string) => {
      socket.on("connect", () => {
        setSocketConnected(true);
        socket.emit("join-room", { sessionId: sessionIdValue, token });
      });

      socket.on("disconnect", () => {
        setSocketConnected(false);
        setLiveKitConnected(false);
      });

      socket.on("join-room-success", (payload) => {
        handleJoinSuccess(payload);
        setMessagesLoading(true);
        socket.emit("get-session-participants", sessionIdValue);
        socket.emit("get-message-history", { sessionId: sessionIdValue });
      });

      socket.on("join-room-error", (payload: { message: string }) => {
        setError(payload.message);
        setJoining(false);
      });

      socket.on("session-participants", (payload: { participants: MeetParticipant[] }) => {
        setParticipants(
          payload.participants.map((participant) => ({
            ...participant,
            isAudioEnabled: participant.isAudioEnabled ?? true,
            isVideoEnabled: participant.isVideoEnabled ?? true,
          })),
        );
      });

      socket.on("session-participants-error", (payload: { message: string }) => {
        setError(payload.message);
      });

      socket.on("user-joined", (payload: MeetParticipant) => {
        upsertParticipant({
          ...payload,
          isAudioEnabled: payload.isAudioEnabled ?? true,
          isVideoEnabled: payload.isVideoEnabled ?? true,
          isOnline: payload.isOnline ?? true,
        });
      });

      socket.on("user-left", (payload: { userId: string }) => {
        removeParticipant(payload.userId);
      });

      socket.on("chat-message", (payload: {
        sessionId: string;
        message: string;
        userId: string;
        userFullName: string;
        userAvatar?: string;
        timestamp: Date | string;
      }) => {
        // Validate payload structure (ChatMessageResponseDto format)
        if (!payload || !payload.sessionId || !payload.message || !payload.userId || !payload.userFullName || !payload.timestamp) {
          return;
        }

        // Generate a unique ID for this message (backend doesn't provide one)
        const timestampStr = typeof payload.timestamp === "string" 
          ? payload.timestamp 
          : new Date(payload.timestamp).toISOString();
        const messageId = `msg-${payload.userId}-${timestampStr}-${Math.random().toString(36).substring(2, 9)}`;

        // Normalize to MeetChatMessage format
        const normalizedPayload: MeetChatMessage = {
          id: messageId,
          sessionId: payload.sessionId,
          content: payload.message,
          sentAt: timestampStr,
          sender: {
            id: payload.userId,
            full_name: payload.userFullName,
            avatar_url: payload.userAvatar || undefined,
          },
        };

        const state = getStoreState();
        const localUserId = state.localUserId;
        const isOwnMessage = normalizedPayload.sender.id === localUserId;
        
        // Check if message already exists (prevent duplicates based on content + sender + timestamp)
        const messageExists = state.messages.some(
          (msg) =>
            msg.content === normalizedPayload.content &&
            msg.sender?.id === normalizedPayload.sender?.id &&
            Math.abs(
              new Date(msg.sentAt).getTime() - 
              new Date(normalizedPayload.sentAt).getTime()
            ) < 1000 // Within 1 second = same message
        );
        if (messageExists) {
          return;
        }
        
        // Remove any temporary messages with the same content from the same sender
        const filteredMessages = state.messages.filter(
          (msg) =>
            !(
              msg.id.startsWith("temp-") &&
              msg.content === normalizedPayload.content &&
              msg.sender?.id === normalizedPayload.sender?.id &&
              Math.abs(
                new Date(msg.sentAt).getTime() - 
                new Date(normalizedPayload.sentAt).getTime()
              ) < 5000
            ),
        );
        
        // Add the real message
        useMeetStore.setState({
          messages: [...filteredMessages, normalizedPayload],
          lastUpdatedAt: Date.now(),
        });

        // Show notification and play sound for messages from other users
        if (!isOwnMessage) {
          const state = getStoreState();
          const isChatOpen = state.showChat;
          
          // Play notification sound
          playNotificationSound();
          
          // Only show toast if chat panel is not open
          if (!isChatOpen) {
            // Show toast notification with message preview
            const messagePreview = normalizedPayload.content.length > 50 
              ? normalizedPayload.content.substring(0, 50) + "..."
              : normalizedPayload.content;
            
            toast.info(messagePreview, {
              description: `From ${normalizedPayload.sender.full_name}`,
              duration: 5000,
              position: "top-right",
            });
          }
        }
      });

      socket.on("message-history", (payload: { messages: MeetChatMessage[]; hasMore: boolean }) => {
        prependChatMessages(payload.messages, payload.hasMore);
        setMessagesLoading(false);
      });

      socket.on("message-history-error", (payload: { message: string }) => {
        setError(payload.message);
        setMessagesLoading(false);
      });

      // Media state is managed entirely by LiveKit track events
      // Socket events are only for notifications/logging, not state management
      // LiveKit automatically syncs track state across all participants via WebRTC
      socket.on("media-toggled", () => {
        // No state updates here - LiveKit track events handle all media state synchronization
        // This event is only for logging/analytics if needed
      });

      // Screen share state is managed by LiveKit track events
      // Socket events update activeScreenSharer to enforce single screen share
      socket.on("screen-share-started", (payload: { userId: string; sessionId: string; userFullName: string; userAvatar?: string; isSharing: boolean }) => {
        // Update activeScreenSharer to enforce that only one person can share at a time
        setActiveScreenSharer(payload.userId);
        // TrackStateSync will handle local screen sharing state updates from LiveKit track events
      });

      socket.on("screen-share-stopped", (payload: { userId: string; sessionId: string; userFullName: string; userAvatar?: string; isSharing: boolean }) => {
        // Clear activeScreenSharer when screen share stops
        const currentActiveSharer = useMeetStore.getState().activeScreenSharer;
        if (currentActiveSharer === payload.userId) {
          setActiveScreenSharer(null);
        }
        // TrackStateSync will handle local screen sharing state updates from LiveKit track events
      });

      socket.on("screen-share-error", (payload: { message: string }) => {
        setError(payload.message);
        toast.error(payload.message);
        // If backend rejected screen share, we need to stop it in LiveKit
        // This will be handled in MeetControls component which has room access
      });

      // --- NEW EVENTS ---

      socket.on("participant-kicked", (payload: ParticipantKickedEvent) => {
        toast.info(`${payload.kickedUserName} was kicked by ${payload.kickedByUserName}`);
        removeParticipant(payload.kickedUserId);
      });

      socket.on("kicked-from-session", () => {
        toast.error("Bạn đã bị loại khỏi buổi học.");
        leaveSession(false); // Don't emit leave event since we're already kicked
        router.push("/");
      });

      socket.on("participant-media-stopped", (payload: ParticipantMediaStoppedEvent) => {
        setParticipantMediaState(payload.targetUserId, {
          isAudioEnabled: payload.mediaType === 'audio' || payload.mediaType === 'both' ? false : undefined,
          isVideoEnabled: payload.mediaType === 'video' || payload.mediaType === 'both' ? false : undefined,
        });
        
        const state = getStoreState();
        if (payload.targetUserId === state.localUserId) {
          if (payload.mediaType === 'audio' || payload.mediaType === 'both') {
            setAudioEnabled(false);
            toast.warning(`Âm thanh của bạn đã bị tắt bởi ${payload.stoppedByUserName}`);
          }
          if (payload.mediaType === 'video' || payload.mediaType === 'both') {
            setVideoEnabled(false);
            toast.warning(`Video của bạn đã bị dừng bởi ${payload.stoppedByUserName}`);
          }
        }
      });

      socket.on("recording-started", (payload: RecordingStartedEvent) => {
        setRecording(true);
        toast.info(`Ghi hình đã được bắt đầu bởi ${payload.startedByUserName}`);
      });

      socket.on("recording-stopped", (payload: RecordingStoppedEvent) => {
        setRecording(false);
        toast.info(`Ghi hình đã được dừng bởi ${payload.stoppedByUserName}`);
      });

      // Error handlers for new actions
      socket.on("kick-participant-error", (payload: { message: string }) => {
        toast.error(payload.message);
      });
      
      socket.on("stop-participant-media-error", (payload: { message: string }) => {
        toast.error(payload.message);
      });
      
      socket.on("start-recording-error", (payload: { message: string }) => {
        toast.error(payload.message);
        setRecording(false);
      });

      socket.on("stop-recording-error", (payload: { message: string }) => {
        toast.error(payload.message);
      });
    },
    [
      handleJoinSuccess,
      prependChatMessages,
      removeParticipant,
      setAudioEnabled,
      setError,
      setLiveKitConnected,
      setMessagesLoading,
      setParticipantMediaState,
      setParticipants,
      setRecording,
      setSocketConnected,
      setVideoEnabled,
      upsertParticipant,
      getStoreState,
      leaveSession,
      router,
      setJoining,
    ],
  );

  const joinSession = useCallback(
    async (sessionIdValue: string, tokenOverride?: string) => {
      if (!sessionIdValue) return;
      setJoining(true);
      setSessionId(sessionIdValue);

      try {
        const supabaseToken =
          tokenOverride ||
          (await supabase.auth.getSession()).data.session?.access_token ||
          null;
        if (!supabaseToken) {
          throw new Error("Không thể xác định phiên người dùng.");
        }

        cleanupSocket();
        const socket = createMeetSocket(supabaseToken);
        socketRef.current = socket;
        bindSocketEvents(socket, sessionIdValue, supabaseToken);
        socket.connect();

        // Pre-fetch LiveKit credentials via REST in case socket handshake delays
        const livekitResponse = await getLivekitToken(sessionIdValue);
        if (livekitResponse?.livekit) {
          setLivekitCredentials(livekitResponse.livekit);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Không thể tham gia buổi học.";
        setJoining(false);
        setError(message);
        cleanupSocket();
      }
    },
    [bindSocketEvents, cleanupSocket, setError, setJoining, setLivekitCredentials, setSessionId, supabase],
  );

  const sendChatMessage = useCallback(
    (message: string) => {
      const socket = socketRef.current;
      if (!sessionId || !socket?.connected) return;
      
      // Optimistic update: add message immediately to store
      const state = getStoreState();
      const localUserId = state.localUserId;
      const localParticipant = localUserId ? state.participants[localUserId] : null;
      
      if (localUserId && localParticipant) {
        const optimisticMessage: MeetChatMessage = {
          id: `temp-${Date.now()}-${Math.random()}`,
          sessionId,
          content: message,
          sentAt: new Date().toISOString(),
          sender: {
            id: localUserId,
            full_name: localParticipant.userFullName,
            avatar_url: localParticipant.userAvatar || undefined,
          },
        };
        addChatMessage(optimisticMessage);
      }
      
      const payload: ChatMessagePayload = { sessionId, message };
      socket.emit("chat-message", payload);
    },
    [sessionId, addChatMessage, getStoreState],
  );

  const loadMessageHistory = useCallback(
    (options?: { before?: string; limit?: number }) => {
      const socket = socketRef.current;
      if (!sessionId || !socket?.connected) return;
      setMessagesLoading(true);
      const payload: MessageHistoryRequest = {
        sessionId,
        limit: options?.limit,
        before: options?.before,
      };
      socket.emit("get-message-history", payload);
    },
    [sessionId, setMessagesLoading],
  );

  const requestParticipantsSnapshot = useCallback(() => {
    const socket = socketRef.current;
    if (!sessionId || !socket?.connected) return;
    socket.emit("get-session-participants", sessionId);
  }, [sessionId]);

  const emitToggleMedia = useCallback(
    (payload: ToggleMediaPayload) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      
      // Emit socket event to notify other participants
      // Don't update local state here - let TrackStateSync handle it from LiveKit events
      // This prevents race conditions and ensures state matches actual track state
      socket.emit("toggle-media", payload);
    },
    [],
  );

  const emitScreenShareEvent = useCallback(
    (type: "start" | "stop", payload: ScreenSharePayload) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      socket.emit(type === "start" ? "start-screen-share" : "stop-screen-share", payload);
      if (payload.sessionId === sessionId) {
        setScreenSharing(type === "start");
      }
    },
    [sessionId, setScreenSharing],
  );

  // --- NEW ACTIONS ---

  const kickParticipant = useCallback((userId: string) => {
    const socket = socketRef.current;
    if (!sessionId || !socket?.connected) return;
    const payload: KickParticipantPayload = { sessionId, targetUserId: userId };
    socket.emit("kick-participant", payload);
  }, [sessionId]);

  const stopParticipantMedia = useCallback((userId: string, mediaType: 'audio' | 'video' | 'both') => {
    const socket = socketRef.current;
    if (!sessionId || !socket?.connected) return;
    const payload: StopParticipantMediaPayload = { sessionId, targetUserId: userId, mediaType };
    socket.emit("stop-participant-media", payload);
  }, [sessionId]);

  const startRecording = useCallback(() => {
    const socket = socketRef.current;
    if (!sessionId || !socket?.connected) return;
    const payload: StartRecordingPayload = { sessionId };
    socket.emit("start-recording", payload);
  }, [sessionId]);

  const stopRecording = useCallback(() => {
    const socket = socketRef.current;
    if (!sessionId || !socket?.connected) return;
    const payload: StopRecordingPayload = { sessionId };
    socket.emit("stop-recording", payload);
  }, [sessionId]);

  useEffect(() => {
    if (!autoJoin || !sessionId) return;
    joinSession(sessionId);
    return () => leaveSession(true);
  }, [autoJoin, joinSession, leaveSession, sessionId]);

  return {
    socket: socketRef.current,
    joinSession,
    leaveSession,
    sendChatMessage,
    loadMessageHistory,
    requestParticipantsSnapshot,
    emitToggleMedia,
    emitScreenShareEvent,
    kickParticipant,
    stopParticipantMedia,
    startRecording,
    stopRecording,
  };
}
