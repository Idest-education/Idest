"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import {
  connectMeetSocket,
  disconnectMeetSocket,
} from "@/lib/meet-socket";
import {
  createPeerConnection,
  addLocalStreamToPeer,
  getUserMedia,
  getDisplayMedia,
  stopMediaStream,
  toggleAudioTrack,
  toggleVideoTrack,
  closePeerConnection,
} from "@/services/webrtc.service";
import {
  Participant,
  ChatMessageResponse,
  MessageHistoryResponse,
  JoinRoomSuccessResponse,
  UserJoinedDto,
  UserLeftDto,
  SessionParticipantsDto,
  WebRTCOfferResponse,
  WebRTCAnswerResponse,
  ICECandidateResponse,
  ErrorResponse,
} from "@/types/meet";

export interface UseMeetingReturn {
  // Connection state
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
  
  // Media state
  localStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  
  // Participants
  participants: Participant[];
  localParticipant: Participant | null;
  
  // Messages
  messages: ChatMessageResponse[];
  messageHistory: MessageHistoryResponse[];
  
  // Remote streams (userId -> MediaStream)
  remoteStreams: Map<string, MediaStream>;
  
  // Actions
  joinRoom: (sessionId: string, token: string) => Promise<void>;
  leaveRoom: (sessionId: string) => void;
  sendMessage: (sessionId: string, message: string) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  loadMessageHistory: (sessionId: string, limit?: number, before?: string) => void;
}

export function useMeeting(): UseMeetingReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageHistoryResponse[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const joinRoomInProgressRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalCameraTrackRef = useRef<MediaStreamTrack | null>(null);

  // Initialize local media stream
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      originalCameraTrackRef.current = stream.getVideoTracks()[0] || null;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Failed to get user media:", err);
      setError("Failed to access camera/microphone. Please check permissions.");
      throw err;
    }
  }, []);

  // Setup WebRTC peer connection handlers
  const setupPeerConnection = useCallback((userId: string, pc: RTCPeerConnection) => {
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`📹 Received track from ${userId}:`, event);
      const stream = event.streams[0];
      if (stream) {
        console.log(`✅ Adding remote stream for ${userId}, tracks:`, stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(userId, stream);
          return next;
        });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && currentSessionIdRef.current && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          sessionId: currentSessionIdRef.current,
          targetUserId: userId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Peer connection state for ${userId}:`, pc.connectionState);
    };
  }, []);

  // Establish WebRTC connection with a peer
  const establishPeerConnection = useCallback(
    async (userId: string, isInitiator: boolean) => {
      if (userId === currentUserIdRef.current) return;

      // Check if peer connection already exists
      if (peerConnectionsRef.current.has(userId)) {
        console.log(`🔗 Peer connection with ${userId} already exists, skipping`);
        return;
      }

      console.log(`🔗 Establishing peer connection with ${userId}, isInitiator: ${isInitiator}`);
      const pc = createPeerConnection(userId);
      peerConnectionsRef.current.set(userId, pc);
      setupPeerConnection(userId, pc);

      // Add local stream if available (use ref to get the latest value)
      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream) {
        console.log(`📤 Adding local stream to peer ${userId}, tracks:`, currentLocalStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
        addLocalStreamToPeer(pc, currentLocalStream);
      } else {
        console.warn(`⚠️ No local stream available when connecting to ${userId}`);
      }

      if (isInitiator) {
        // Create and send offer
        try {
          console.log(`📤 Creating offer for ${userId}`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (socketRef.current && currentSessionIdRef.current) {
            socketRef.current.emit("webrtc-offer", {
              sessionId: currentSessionIdRef.current,
              targetUserId: userId,
              offer: offer,
            });
            console.log(`✅ Offer sent to ${userId}`);
          }
        } catch (err) {
          console.error("Error creating offer:", err);
        }
      }
    },
    [setupPeerConnection]
  );

  // Setup socket event listeners
  const setupSocketListeners = useCallback(
    (socket: Socket, sessionId: string) => {
      // Remove any existing listeners to prevent duplicates
      socket.off("join-room-success");
      socket.off("join-room-error");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("session-participants");
      socket.off("chat-message");
      socket.off("message-history");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
      socket.off("disconnect");
      socket.off("connect_error");
      
      // Join success
      socket.on("join-room-success", (data: JoinRoomSuccessResponse) => {
        currentUserIdRef.current = data.userId;
        setIsConnected(true);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;

        // Request participants
        socket.emit("get-session-participants", sessionId);
      });

      // Join error
      socket.on("join-room-error", (error: ErrorResponse) => {
        console.error("Join room error:", error);
        const errorMessage = error.message || error.details || "Failed to join room";
        setError(errorMessage);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;
        
        // Cleanup socket on error
        if (socketRef.current) {
          disconnectMeetSocket();
        }
      });

      // User joined
      socket.on("user-joined", async (data: UserJoinedDto) => {
        if (data.userId === currentUserIdRef.current) {
          // This is us, update local participant
          setLocalParticipant({
            userId: data.userId,
            userFullName: data.userFullName,
            userAvatar: data.userAvatar,
            role: data.role,
            socketId: data.socketId,
            isOnline: true,
          });
        } else {
          // New participant joined
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

          // Establish peer connection
          await establishPeerConnection(data.userId, true);
        }
      });

      // User left
      socket.on("user-left", (data: UserLeftDto) => {
        setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));

        // Close peer connection
        const pc = peerConnectionsRef.current.get(data.userId);
        if (pc) {
          closePeerConnection(pc);
          peerConnectionsRef.current.delete(data.userId);
        }

        // Remove remote stream
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      });

      // Session participants
      socket.on("session-participants", async (data: SessionParticipantsDto) => {
        const currentUserId = currentUserIdRef.current;
        
        // Separate local and remote participants
        const local = data.participants.find((p) => p.userId === currentUserId);
        const remote = data.participants.filter((p) => p.userId !== currentUserId);

        if (local) {
          setLocalParticipant(local);
        }
        setParticipants(remote);

        // Establish connections with all existing participants
        for (const participant of remote) {
          await establishPeerConnection(participant.userId, true);
        }
      });

      // Chat message
      socket.on("chat-message", (data: ChatMessageResponse) => {
        setMessages((prev) => [...prev, data]);
      });

      // Message history
      socket.on("message-history", (data: { messages: MessageHistoryResponse[]; hasMore: boolean; total: number }) => {
        setMessageHistory(data.messages);
      });

      // WebRTC offer
      socket.on("webrtc-offer", async (data: WebRTCOfferResponse) => {
        console.log(`📥 Received offer from ${data.fromUserId}`);
        let pc = peerConnectionsRef.current.get(data.fromUserId);
        
        // Only create new peer connection if it doesn't exist
        if (!pc) {
          pc = createPeerConnection(data.fromUserId);
          peerConnectionsRef.current.set(data.fromUserId, pc);
          setupPeerConnection(data.fromUserId, pc);

          const currentLocalStream = localStreamRef.current;
          if (currentLocalStream) {
            console.log(`📤 Adding local stream when responding to ${data.fromUserId}`);
            addLocalStreamToPeer(pc, currentLocalStream);
          }
        }

        await pc.setRemoteDescription(data.offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          sessionId: data.sessionId,
          targetUserId: data.fromUserId,
          answer: answer,
        });
        console.log(`✅ Answer sent to ${data.fromUserId}`);
      });

      // WebRTC answer
      socket.on("webrtc-answer", async (data: WebRTCAnswerResponse) => {
        console.log(`📥 Received answer from ${data.fromUserId}`);
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (pc) {
          try {
            await pc.setRemoteDescription(data.answer);
            console.log(`✅ Set remote description for ${data.fromUserId}`);
          } catch (err) {
            console.error("Error setting remote description:", err);
          }
        }
      });

      // ICE candidate
      socket.on("ice-candidate", async (data: ICECandidateResponse) => {
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (pc && data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
            console.log(`🧊 Added ICE candidate from ${data.fromUserId}`);
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        }
      });

      // Connection errors
      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("connect_error", (err) => {
        setError(`Connection error: ${err.message}`);
      });
    },
    [establishPeerConnection, setupPeerConnection]
  );

  // Join room
  const joinRoom = useCallback(
    async (sessionId: string, token: string) => {
      // Prevent multiple simultaneous join attempts
      if (joinRoomInProgressRef.current || isJoining || isConnected) {
        console.log("Already joining or connected, skipping");
        return;
      }

      joinRoomInProgressRef.current = true;
      setIsJoining(true);
      setError(null);
      currentSessionIdRef.current = sessionId;

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

        // Wait for connection with better error handling
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
            console.log("✅ Socket connected, setting up listeners");
            cleanup();
            resolve();
          };

          const onError = (err: Error) => {
            console.error("❌ Socket connection error:", err);
            cleanup();
            reject(err);
          };

          const onDisconnect = (reason: string) => {
            console.error("❌ Socket disconnected before join:", reason);
            if (reason === "io server disconnect") {
              cleanup();
              reject(new Error("Server disconnected: " + reason));
            }
          };

          socket.once("connect", onConnect);
          socket.once("connect_error", onError);
          socket.on("disconnect", onDisconnect);

          // Check if already connected
          if (socket.connected) {
            console.log("Socket already connected");
            cleanup();
            resolve();
          }
        });

        console.log("Socket connected, setting up listeners");
        // Setup socket event listeners
        setupSocketListeners(socket, sessionId);

        // Join room
        console.log("Emitting join-room event", { 
          sessionId, 
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + "..." 
        });
        socket.emit("join-room", { sessionId, token });
      } catch (err) {
        console.error("Error joining room:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to join meeting";
        setError(errorMessage);
        setIsJoining(false);
        joinRoomInProgressRef.current = false;
        
        // Cleanup on error
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
    
    if (socketRef.current) {
      socketRef.current.emit("leave-room", sessionId);
      disconnectMeetSocket();
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      closePeerConnection(pc);
    });
    peerConnectionsRef.current.clear();

    // Stop local stream
    stopMediaStream(localStreamRef.current);
    stopMediaStream(screenShareStreamRef.current);

    // Reset state
    setIsConnected(false);
    setIsJoining(false);
    setParticipants([]);
    setLocalParticipant(null);
    setMessages([]);
    setMessageHistory([]);
    setRemoteStreams(new Map());
    setLocalStream(null);
    localStreamRef.current = null;
    originalCameraTrackRef.current = null;
    setIsScreenSharing(false);
    currentSessionIdRef.current = null;
    currentUserIdRef.current = null;
  }, []);

  // Send message
  const sendMessage = useCallback((sessionId: string, message: string) => {
    if (socketRef.current && message.trim()) {
      socketRef.current.emit("chat-message", { sessionId, message });
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      const newState = !isAudioEnabled;
      toggleAudioTrack(currentLocalStream, newState);
      setIsAudioEnabled(newState);

      // Update track in all peer connections
      const audioTrack = currentLocalStream.getAudioTracks()[0];
      if (audioTrack) {
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender && audioTrack) {
            sender.replaceTrack(audioTrack);
          }
        });
      }
    }
  }, [isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      const newState = !isVideoEnabled;
      toggleVideoTrack(currentLocalStream, newState);
      setIsVideoEnabled(newState);

      // Update track in all peer connections
      const videoTrack = currentLocalStream.getVideoTracks()[0];
      if (videoTrack) {
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
    }
  }, [isVideoEnabled]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        stopMediaStream(screenShareStreamRef.current);
        screenShareStreamRef.current = null;

        // Restore camera track in peer connections
        const cameraTrack = originalCameraTrackRef.current;
        console.log(`🔄 Restoring camera track:`, cameraTrack ? { readyState: cameraTrack.readyState } : 'null');
        if (cameraTrack && cameraTrack.readyState === 'live') {
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender && cameraTrack) {
              sender.replaceTrack(cameraTrack);
            }
          });
        } else {
          console.warn('⚠️ Cannot restore camera track:', cameraTrack ? cameraTrack.readyState : 'null');
        }

        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await getDisplayMedia();
        screenShareStreamRef.current = screenStream;

        // Replace video track with screen share in peer connections only
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          // Store camera track before replacing if not already stored
          if (!originalCameraTrackRef.current) {
            const currentLocalStream = localStreamRef.current;
            if (currentLocalStream) {
              originalCameraTrackRef.current = currentLocalStream.getVideoTracks()[0] || null;
              console.log(`📹 Storing original camera track:`, originalCameraTrackRef.current ? { readyState: originalCameraTrackRef.current.readyState } : 'null');
            }
          }

          // Replace track in all peer connections
          console.log(`🖥️ Replacing with screen track in ${peerConnectionsRef.current.size} peer connections`);
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender && screenTrack) {
              sender.replaceTrack(screenTrack);
            }
          });
        }

        setIsScreenSharing(true);

        // Stop screen share when user stops sharing
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
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
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    participants,
    localParticipant,
    messages,
    messageHistory,
    remoteStreams,
    joinRoom,
    leaveRoom,
    sendMessage,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    loadMessageHistory,
  };
}

