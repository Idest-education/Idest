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
  ScreenShareResponseDto,
  ScreenShareErrorDto,
  MediaToggleResponseDto,
  MediaToggleErrorDto,
  SessionEndedDto,
  AttendeeCountUpdatedDto,
} from "@/types/meet";

export interface UseMeetingReturn {
  // Connection state
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;
  
  // Media state
  localStream: MediaStream | null;
  localScreenShareStream: MediaStream | null;
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
  
  // Remote screen share streams (userId -> MediaStream)
  remoteScreenShareStreams: Map<string, MediaStream>;
  
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
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const joinRoomInProgressRef = useRef<boolean>(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const currentTokenRef = useRef<string | null>(null);
  // Queue for ICE candidates that arrive before remote description is set
  const queuedIceCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());

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
      
      // Provide specific error messages based on the error type
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

  // Process queued ICE candidates for a peer connection
  const processQueuedIceCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const queued = queuedIceCandidatesRef.current.get(userId);
    if (queued && queued.length > 0) {
      console.log(`Processing ${queued.length} queued ICE candidates for ${userId}`);
      for (const candidate of queued) {
        try {
          // candidate is already an RTCIceCandidate object
          await pc.addIceCandidate(candidate);
          console.log(`Added queued ICE candidate from ${userId}`);
        } catch (err) {
          console.error(`Error adding queued ICE candidate from ${userId}:`, err);
        }
      }
      // Clear the queue after processing
      queuedIceCandidatesRef.current.delete(userId);
    }
  }, []);

  // Setup WebRTC peer connection handlers
  const setupPeerConnection = useCallback((userId: string, pc: RTCPeerConnection) => {
    // Handle remote stream - can receive multiple tracks from same peer
    pc.ontrack = (event) => {
      console.log(`Received track from ${userId}:`, event);
      const stream = event.streams[0];
      if (stream) {
        const tracks = stream.getTracks();
        console.log(`Adding remote stream for ${userId}, tracks:`, tracks.map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
        
        // Check if this is a screen share track
        const hasScreenTrack = tracks.some(t => t.kind === 'video' && t.label.toLowerCase().includes('screen'));
        
        if (hasScreenTrack) {
          // This is a screen share stream
          setRemoteScreenShareStreams((prev) => {
            const next = new Map(prev);
            next.set(userId, stream);
            return next;
          });
        } else {
          // This is the user's video/audio stream
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(userId, stream);
            return next;
          });
        }
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
        console.log(`Peer connection with ${userId} already exists, skipping`);
        return;
      }

      console.log(`Establishing peer connection with ${userId}, isInitiator: ${isInitiator}`);
      const pc = createPeerConnection(userId);
      peerConnectionsRef.current.set(userId, pc);
      setupPeerConnection(userId, pc);

      // Add local stream if available (use ref to get the latest value)
      const currentLocalStream = localStreamRef.current;
      if (currentLocalStream) {
        console.log(`Adding local stream to peer ${userId}, tracks:`, currentLocalStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })));
        addLocalStreamToPeer(pc, currentLocalStream);
      } else {
        console.warn(`No local stream available when connecting to ${userId}`);
      }

      if (isInitiator) {
        // Create and send offer
        try {
          // Check if we're in a valid state to create an offer
          const signalingState = pc.signalingState;
          if (signalingState !== "stable") {
            console.warn(`Cannot create offer in ${signalingState} state for ${userId}`);
            // If we're in a weird state, log it but continue
            if (signalingState === "have-local-offer") {
              console.log(`Already have local offer for ${userId}, skipping`);
              return;
            }
          }
          
          console.log(`Creating offer for ${userId}`);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log(`Set local description (offer) for ${userId}`);

          if (socketRef.current && currentSessionIdRef.current) {
            socketRef.current.emit("webrtc-offer", {
              sessionId: currentSessionIdRef.current,
              targetUserId: userId,
              offer: offer,
            });
            console.log(`Offer sent to ${userId}`);
          }
        } catch (err) {
          console.error("Error creating offer:", err);
          // Log the current state for debugging
          console.error(`Current signaling state: ${pc.signalingState}`);
          console.error(`Local description: ${pc.localDescription ? "set" : "not set"}`);
          console.error(`Remote description: ${pc.remoteDescription ? "set" : "not set"}`);
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
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("screen-share-error");
      socket.off("media-toggled");
      socket.off("media-toggle-error");
      socket.off("session-ended");
      socket.off("attendee-count-updated");
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
        const isSelfByUserId = data.userId === currentUserIdRef.current;
        const isSelfBySocketId = socketRef.current && data.socketId === socketRef.current.id;
        if (isSelfByUserId || isSelfBySocketId) {
          // This is me, update local participant
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

          // Establish peer connection but do not initiate offer here.
          // The newly joined user will initiate offers to existing participants
          await establishPeerConnection(data.userId, false);
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

        // Remove remote streams (both regular and screen share)
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
        
        setRemoteScreenShareStreams((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      });

      // Session participants
      socket.on("session-participants", async (data: SessionParticipantsDto) => {
        const currentUserId = currentUserIdRef.current;
        const currentSocketId = socketRef.current?.id;
        
        // Separate local and remote participants
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

        // Only initiate connections to ONLINE participants in the session
        const onlineRemote = remote.filter((p) => p.isOnline && !!p.socketId);
        for (const participant of onlineRemote) {
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
        if (data.fromUserId === currentUserIdRef.current) {
          console.warn("Ignoring self-originated offer");
          return;
        }
        console.log(`Received offer from ${data.fromUserId}`);
        let pc = peerConnectionsRef.current.get(data.fromUserId);
        
        // Only create new peer connection if it doesn't exist
        if (!pc) {
          pc = createPeerConnection(data.fromUserId);
          peerConnectionsRef.current.set(data.fromUserId, pc);
          setupPeerConnection(data.fromUserId, pc);

          const currentLocalStream = localStreamRef.current;
          if (currentLocalStream) {
            console.log(`Adding local stream when responding to ${data.fromUserId}`);
            addLocalStreamToPeer(pc, currentLocalStream);
          }
        } else {
          // If peer connection exists, check its state
          const signalingState = pc.signalingState;
          console.log(`Existing peer connection signaling state for ${data.fromUserId}: ${signalingState}`);
          
          // If we already have a local offer (we initiated), ignore this offer
          if (signalingState === "have-local-offer") {
            console.warn(`Already have local offer for ${data.fromUserId}, ignoring incoming offer`);
            return;
          }
          
          // If we're in stable state with a remote description, connection is already established
          if (signalingState === "stable" && pc.remoteDescription) {
            // Check if this is a duplicate offer
            if (pc.remoteDescription.sdp === data.offer.sdp) {
              console.log(`Duplicate offer detected for ${data.fromUserId}, ignoring`);
              return;
            }
            // If it's a different offer, log it but continue processing (might be a renegotiation)
            console.warn(`Received new offer for ${data.fromUserId} but connection already established`);
          }
        }

        try {
          // Check signaling state before setting remote description (offer)
          const signalingState = pc.signalingState;
          console.log(`Processing offer, signaling state: ${signalingState}`);
          
          // We can process an offer if we're in stable state (no description set) 
          // or if we're replacing an old remote offer
          if (signalingState === "stable" || signalingState === "have-remote-offer") {
            // If we already have a remote offer, check if it's a duplicate
            if (signalingState === "have-remote-offer" && pc.remoteDescription) {
              if (pc.remoteDescription.sdp === data.offer.sdp) {
                console.log(`Duplicate offer detected for ${data.fromUserId}, ignoring`);
                return;
              }
              // Different offer - this might be a renegotiation, we'll replace it
              console.log(`Replacing existing remote offer for ${data.fromUserId}`);
            }
            
            await pc.setRemoteDescription(data.offer);
            console.log(`Set remote description (offer) for ${data.fromUserId}`);
            
            // Process any queued ICE candidates now that remote description is set
            await processQueuedIceCandidates(data.fromUserId, pc);
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log(`Set local description (answer) for ${data.fromUserId}`);

            socket.emit("webrtc-answer", {
              sessionId: data.sessionId,
              targetUserId: data.fromUserId,
              answer: answer,
            });
            console.log(`Answer sent to ${data.fromUserId}`);
          } else {
            console.warn(`Cannot set offer in ${signalingState} state for ${data.fromUserId}`);
          }
        } catch (err) {
          console.error("Error handling offer:", err);
          if (pc) {
            console.error(`Current signaling state: ${pc.signalingState}`);
            console.error(`Local description: ${pc.localDescription ? "set" : "not set"}`);
            console.error(`Remote description: ${pc.remoteDescription ? "set" : "not set"}`);
          }
        }
      });

      // WebRTC answer
      socket.on("webrtc-answer", async (data: WebRTCAnswerResponse) => {
        console.log(`Received answer from ${data.fromUserId}`);
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (pc) {
          try {
            // Check signaling state before setting remote description
            const signalingState = pc.signalingState;
            console.log(`Signaling state for ${data.fromUserId}: ${signalingState}`);
            
            // We can only set remote description (answer) if we're in "have-local-offer" state
            // This means we've already set a local offer and are waiting for the answer
            if (signalingState === "have-local-offer") {
              await pc.setRemoteDescription(data.answer);
              console.log(`Set remote description for ${data.fromUserId}`);
              
              // Process any queued ICE candidates now that remote description is set
              await processQueuedIceCandidates(data.fromUserId, pc);
            } else if (signalingState === "stable") {
              // If we're in stable state, we might have already processed this answer
              // or the offer was never sent. Check if remote description is already set
              if (pc.remoteDescription) {
                console.log(`Remote description already set for ${data.fromUserId}, skipping`);
              } else {
                console.warn(`Cannot set answer in stable state for ${data.fromUserId}. Local description may not be set.`);
                // Try to check if we have a local description
                if (!pc.localDescription) {
                  console.error(`No local description found for ${data.fromUserId}. Offer may not have been sent.`);
                }
              }
            } else if (signalingState === "have-remote-offer") {
              // This shouldn't happen - we're receiving an answer but we have a remote offer
              // This means both sides are trying to be the initiator
              console.warn(`Received answer but in "have-remote-offer" state for ${data.fromUserId}. Connection may be in wrong state.`);
            } else {
              console.warn(`Cannot set answer in ${signalingState} state for ${data.fromUserId}`);
            }
          } catch (err) {
            console.error("Error setting remote description:", err);
            // Log the current state for debugging
            if (pc) {
              console.error(`Current signaling state: ${pc.signalingState}`);
              console.error(`Local description: ${pc.localDescription ? "set" : "not set"}`);
              console.error(`Remote description: ${pc.remoteDescription ? "set" : "not set"}`);
            }
          }
        } else {
          console.warn(`No peer connection found for ${data.fromUserId} when receiving answer`);
        }
      });

      // ICE candidate
      socket.on("ice-candidate", async (data: ICECandidateResponse) => {
        const pc = peerConnectionsRef.current.get(data.fromUserId);
        if (pc && data.candidate) {
          try {
            // Convert RTCIceCandidateInit to RTCIceCandidate
            const candidate = new RTCIceCandidate(data.candidate);
            
            // Check if remote description is set before adding ICE candidate
            if (!pc.remoteDescription) {
              // Queue the candidate if remote description isn't set yet
              console.log(`Queuing ICE candidate from ${data.fromUserId} (waiting for remote description)`);
              const queue = queuedIceCandidatesRef.current.get(data.fromUserId) || [];
              queue.push(candidate);
              queuedIceCandidatesRef.current.set(data.fromUserId, queue);
              return;
            }
            
            // Remote description is set, add the candidate immediately
            await pc.addIceCandidate(candidate);
            console.log(`Added ICE candidate from ${data.fromUserId}`);
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
            // If adding fails, try to queue it for retry later
            try {
              const candidate = new RTCIceCandidate(data.candidate);
              const queue = queuedIceCandidatesRef.current.get(data.fromUserId) || [];
              queue.push(candidate);
              queuedIceCandidatesRef.current.set(data.fromUserId, queue);
            } catch (queueErr) {
              console.error("Error queuing ICE candidate:", queueErr);
            }
          }
        }
      });

      // Screen share started
      socket.on("screen-share-started", (data: ScreenShareResponseDto) => {
        console.log(`Screen share started by ${data.userFullName}`);
        // Update UI to show screen sharing indicator for remote user
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === data.userId ? { ...p, isScreenSharing: true } : p
          )
        );
      });

      // Screen share stopped
      socket.on("screen-share-stopped", (data: ScreenShareResponseDto) => {
        console.log(`Screen share stopped by ${data.userFullName}`);
        // Update UI to hide screen sharing indicator for remote user
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

      // Media toggled
      socket.on("media-toggled", (data: MediaToggleResponseDto) => {
        console.log(`${data.userFullName} toggled ${data.type} to ${data.isEnabled}`);
        // Update participants to reflect media state changes
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
        
        // Clean up and redirect after a short delay
        setTimeout(() => {
          if (currentSessionIdRef.current === data.sessionId) {
            window.location.href = "/sessions";
          }
        }, 3000);
      });

      // Attendee count updated
      socket.on("attendee-count-updated", (data: AttendeeCountUpdatedDto) => {
        console.log(`Attendee count updated for session ${data.sessionId}: ${data.count}`);
        // You can emit a custom event or update state here if needed
      });

      // Connection errors with reconnection logic
      socket.on("disconnect", (reason) => {
        setIsConnected(false);
        
        // Handle different disconnect reasons
        if (reason === "io server disconnect") {
          // Server initiated disconnect, don't reconnect
          setError("Disconnected by server. The session may have ended.");
        } else if (reason === "io client disconnect") {
          // Client initiated disconnect, don't reconnect
          console.log("Client disconnected");
        } else {
          // Unexpected disconnect, attempt reconnection
          console.log("Unexpected disconnect, attempting reconnection...");
          handleReconnection.current?.();
        }
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setError(`Connection error: ${err.message}`);
        
        // Attempt reconnection on connection errors
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          handleReconnection.current?.();
        }
      });
    },
    [establishPeerConnection, setupPeerConnection, processQueuedIceCandidates]
  );

  // Handle reconnection attempts
  const handleReconnection = useRef<(() => void) | undefined>(undefined);
  
  if (!handleReconnection.current) {
    handleReconnection.current = () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError("Failed to reconnect after multiple attempts. Please refresh the page.");
      return;
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 5000); // Exponential backoff
    
    setError(`Connection lost. Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && currentSessionIdRef.current) {
        console.log(`Reconnection attempt ${reconnectAttemptsRef.current}`);
        
        // Reconnect the socket
        socketRef.current.connect();
        
        // Re-emit join room after reconnection
        socketRef.current.once("connect", () => {
          if (currentSessionIdRef.current && currentTokenRef.current && socketRef.current) {
            socketRef.current.emit("join-room", { 
              sessionId: currentSessionIdRef.current, 
              token: currentTokenRef.current
            });
            setError(null);
            reconnectAttemptsRef.current = 0;
          }
        });
      }
    }, delay);
    };
  }

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
      currentTokenRef.current = token;

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
    
    // Clear reconnect timeout if exists
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (socketRef.current) {
      socketRef.current.emit("leave-room", sessionId);
      
      // Remove all socket listeners before disconnecting
      socketRef.current.removeAllListeners();
      
      disconnectMeetSocket();
      socketRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      closePeerConnection(pc);
    });
    peerConnectionsRef.current.clear();

    // Clear queued ICE candidates
    queuedIceCandidatesRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
    }
    
    if (screenShareStreamRef.current) {
      stopMediaStream(screenShareStreamRef.current);
      screenShareStreamRef.current = null;
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
    reconnectAttemptsRef.current = 0;
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

      // Emit socket event to notify others
      if (socketRef.current && currentSessionIdRef.current) {
        socketRef.current.emit("toggle-media", {
          sessionId: currentSessionIdRef.current,
          type: "audio",
          isEnabled: newState,
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

      // Emit socket event to notify others
      if (socketRef.current && currentSessionIdRef.current) {
        socketRef.current.emit("toggle-media", {
          sessionId: currentSessionIdRef.current,
          type: "video",
          isEnabled: newState,
        });
      }
    }
  }, [isVideoEnabled]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing - restore camera track
        stopMediaStream(screenShareStreamRef.current);
        screenShareStreamRef.current = null;
        setLocalScreenShareStream(null);

        // Restore camera track in all peer connections
        const currentLocalStream = localStreamRef.current;
        if (currentLocalStream) {
          const cameraTrack = currentLocalStream.getVideoTracks()[0];
          if (cameraTrack) {
            console.log('Restoring camera track after stopping screen share');
            peerConnectionsRef.current.forEach((pc) => {
              // Replace the first video sender's track with the camera track
              const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
              if (videoSender) {
                videoSender.replaceTrack(cameraTrack);
              }
            });
          }
        }

        setIsScreenSharing(false);

        // Emit socket event to notify others
        if (socketRef.current && currentSessionIdRef.current) {
          socketRef.current.emit("stop-screen-share", {
            sessionId: currentSessionIdRef.current,
          });
        }
      } else {
        // Start screen sharing
        const screenStream = await getDisplayMedia();
        screenShareStreamRef.current = screenStream;
        setLocalScreenShareStream(screenStream);

        // Replace camera track with screen share track in all peer connections
        const screenTrack = screenStream.getVideoTracks()[0];
        if (screenTrack) {
          console.log(`Replacing camera with screen share in ${peerConnectionsRef.current.size} peer connections`);
          peerConnectionsRef.current.forEach((pc) => {
            const senders = pc.getSenders();
            // Find video sender (should only be one for camera)
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender && screenTrack) {
              // Replace the camera track with screen share track
              videoSender.replaceTrack(screenTrack);
            }
          });
        }

        setIsScreenSharing(true);

        // Emit socket event to notify others
        if (socketRef.current && currentSessionIdRef.current) {
          socketRef.current.emit("start-screen-share", {
            sessionId: currentSessionIdRef.current,
          });
        }

        // Stop screen share when user stops sharing via browser button
        screenStream.getVideoTracks()[0].onended = async () => {
          stopMediaStream(screenShareStreamRef.current);
          screenShareStreamRef.current = null;
          setLocalScreenShareStream(null);

          // Restore camera track
          const currentLocalStream = localStreamRef.current;
          if (currentLocalStream) {
            const cameraTrack = currentLocalStream.getVideoTracks()[0];
            if (cameraTrack) {
              peerConnectionsRef.current.forEach((pc) => {
                const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
                if (videoSender) {
                  videoSender.replaceTrack(cameraTrack);
                }
              });
            }
          }

          setIsScreenSharing(false);

          if (socketRef.current && currentSessionIdRef.current) {
            socketRef.current.emit("stop-screen-share", {
              sessionId: currentSessionIdRef.current,
            });
          }
        };
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      if (socketRef.current) {
        socketRef.current.emit("screen-share-error", {
          message: err instanceof Error ? err.message : "Failed to toggle screen share",
        });
      }
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

