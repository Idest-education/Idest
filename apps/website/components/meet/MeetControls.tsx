"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import {
  Mic,
  MicOff,
  MonitorStop,
  MonitorUp,
  PhoneOff,
  Users,
  Video,
  VideoOff,
  MessageSquare,
  Disc,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useMeetStore } from "@/hooks/useMeetStore";
import { ScreenSharePayload, ToggleMediaPayload } from "@/types/meet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MEET_RECORDING_ENABLED =
  process.env.NEXT_PUBLIC_MEET_RECORDING_ENABLED === "true";

interface MeetControlsProps {
  sessionId: string | null;
  onLeave: () => void;
  emitToggleMedia: (payload: ToggleMediaPayload) => void;
  emitScreenShareEvent: (type: "start" | "stop", payload: ScreenSharePayload) => void;
  startRecording: () => void;
  stopRecording: () => void;
  toggleChat: () => void;
  toggleParticipants: () => void;
}

export function MeetControls({
  sessionId,
  onLeave,
  emitToggleMedia,
  emitScreenShareEvent,
  startRecording,
  stopRecording,
  toggleChat,
  toggleParticipants,
}: MeetControlsProps) {
  const room = useRoomContext();
  const isAudioEnabled = useMeetStore((state) => state.isAudioEnabled);
  const isVideoEnabled = useMeetStore((state) => state.isVideoEnabled);
  const isScreenSharing = useMeetStore((state) => state.isScreenSharing);
  const activeScreenSharer = useMeetStore((state) => state.activeScreenSharer);
  const isRecording = useMeetStore((state) => state.isRecording);
  const showChat = useMeetStore((state) => state.showChat);
  const showParticipants = useMeetStore((state) => state.showParticipants);
  const localUserId = useMeetStore((state) => state.localUserId);
  const participants = useMeetStore((state) => state.participants);
  const setAudioEnabled = useMeetStore((state) => state.setAudioEnabled);
  const setVideoEnabled = useMeetStore((state) => state.setVideoEnabled);
  const setScreenSharing = useMeetStore((state) => state.setScreenSharing);
  const error = useMeetStore((state) => state.error);
  const pendingScreenShareRef = useRef<boolean>(false);

  const disabled = !sessionId || !room;

  // Stop screen share in LiveKit if backend rejects it
  useEffect(() => {
    if (error && pendingScreenShareRef.current && isScreenSharing && room) {
      // Backend rejected the screen share attempt, stop it in LiveKit
      room.localParticipant.setScreenShareEnabled(false).catch((err) => {
        console.error("Failed to stop screen share after backend rejection:", err);
      });
      setScreenSharing(false);
      pendingScreenShareRef.current = false;
    }
  }, [error, isScreenSharing, room, setScreenSharing]);

  const canShareScreen = useMemo(() => {
    if (!activeScreenSharer) return true;
    return activeScreenSharer === localUserId;
  }, [activeScreenSharer, localUserId]);

  const activeSharerName = useMemo(() => {
    if (!activeScreenSharer || activeScreenSharer === localUserId) return null;
    return participants[activeScreenSharer]?.userFullName || "Unknown User";
  }, [activeScreenSharer, localUserId, participants]);

  const canRecord = useMemo(() => {
    if (!localUserId) return false;
    const localParticipant = participants[localUserId];
    const role = localParticipant?.role?.toUpperCase();
    // Backend uses uppercase roles: TEACHER, ADMIN, STUDENT
    return role === 'TEACHER' || role === 'ADMIN';
  }, [localUserId, participants]);

  const toggleAudio = useCallback(async () => {
    if (!room || !sessionId) return;

    try {
      const nextState = !isAudioEnabled;
      // LiveKit handles the actual media control
      await room.localParticipant.setMicrophoneEnabled(nextState);

      // Update state immediately for instant UI feedback
      // TrackStateSync will verify/correct this if there's any mismatch
      setAudioEnabled(nextState);

      // Optional: Emit socket event for backend logging/analytics only
      emitToggleMedia({ sessionId, type: "audio", isEnabled: nextState });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể bật/tắt microphone";
      toast.error(message);
      // State will sync from actual LiveKit state via TrackStateSync
    }
  }, [emitToggleMedia, isAudioEnabled, room, sessionId, setAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (!room || !sessionId) return;

    try {
      const nextState = !isVideoEnabled;
      // LiveKit handles the actual media control
      await room.localParticipant.setCameraEnabled(nextState);

      // Update state immediately for instant UI feedback
      // TrackStateSync will verify/correct this if there's any mismatch
      setVideoEnabled(nextState);

      // Optional: Emit socket event for backend logging/analytics only
      emitToggleMedia({ sessionId, type: "video", isEnabled: nextState });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể bật/tắt camera";
      toast.error(message);
      // State will sync from actual LiveKit state via TrackStateSync
    }
  }, [emitToggleMedia, isVideoEnabled, room, sessionId, setVideoEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!room || !sessionId) return;
    if (!canShareScreen) {
      toast.error(`Màn hình hiện đang được chia sẻ bởi ${activeSharerName}`);
      return;
    }

    try {
      const enable = !isScreenSharing;

      if (enable) {
        // Mark that we're attempting to start screen share
        pendingScreenShareRef.current = true;
      } else {
        // Stopping screen share, clear pending flag
        pendingScreenShareRef.current = false;
      }

      // LiveKit handles the actual screen share control
      await room.localParticipant.setScreenShareEnabled(enable);

      // Update state immediately for instant UI feedback
      // TrackStateSync will verify/correct this if there's any mismatch
      setScreenSharing(enable);

      // Emit socket event to backend - backend will enforce single screen share
      emitScreenShareEvent(enable ? "start" : "stop", { sessionId });

      // Clear pending flag after a short delay to allow backend response
      if (enable) {
        setTimeout(() => {
          pendingScreenShareRef.current = false;
        }, 2000);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể bật/tắt chia sẻ màn hình";
      toast.error(message);
      pendingScreenShareRef.current = false;
      // State will sync from actual LiveKit state via TrackStateSync
    }
  }, [emitScreenShareEvent, isScreenSharing, room, sessionId, canShareScreen, activeSharerName, setScreenSharing]);

  const toggleRecording = useCallback(() => {
    if (!sessionId) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [sessionId, isRecording, stopRecording, startRecording]);

  const leaveMeeting = useCallback(async () => {
    try {
      await room?.disconnect();
    } catch {
      // ignore
    } finally {
      onLeave();
    }
  }, [onLeave, room]);

  return (
    <TooltipProvider>
      <div className="flex-shrink-0" style={{ background: "#151515", borderTop: "1px solid #2a2a2a" }}>
        <div className="flex items-center justify-center gap-2 px-4 py-3 flex-wrap">
          <button
            onClick={toggleAudio}
            disabled={disabled}
            className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
            style={
              isAudioEnabled
                ? { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
                : { background: "var(--color-error)", color: "#fff", border: "none" }
            }
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            <span className="hidden sm:inline">{isAudioEnabled ? "Tắt tiếng" : "Bật tiếng"}</span>
          </button>

          <button
            onClick={toggleVideo}
            disabled={disabled}
            className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
            style={
              isVideoEnabled
                ? { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
                : { background: "var(--color-error)", color: "#fff", border: "none" }
            }
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            <span className="hidden sm:inline">{isVideoEnabled ? "Dừng video" : "Bật video"}</span>
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  onClick={toggleScreenShare}
                  disabled={disabled || (!canShareScreen && !isScreenSharing)}
                  className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium relative"
                  style={{ background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }}
                >
                  {isScreenSharing ? <MonitorStop className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
                  <span className="hidden sm:inline">{isScreenSharing ? "Dừng chia sẻ" : "Chia sẻ màn hình"}</span>
                  {!canShareScreen && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                  )}
                </button>
              </span>
            </TooltipTrigger>
            {!canShareScreen && (
              <TooltipContent>
                <p>Screen is being shared by {activeSharerName}</p>
              </TooltipContent>
            )}
          </Tooltip>

          {MEET_RECORDING_ENABLED && canRecord && (
            <button
              onClick={toggleRecording}
              disabled={disabled}
              className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
              style={
                isRecording
                  ? { background: "var(--color-error)", color: "#fff", border: "none" }
                  : { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
              }
            >
              {isRecording ? <StopCircle className="h-5 w-5 animate-pulse" /> : <Disc className="h-5 w-5" />}
              <span className="hidden sm:inline">{isRecording ? "Stop Rec" : "Record"}</span>
            </button>
          )}

          <div className="mx-2 h-6 w-px hidden sm:block" style={{ background: "#2a2a2a" }} />

          <button
            onClick={toggleParticipants}
            disabled={disabled}
            className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
            style={
              showParticipants
                ? { background: "var(--color-brand)", color: "#fff", border: "none" }
                : { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
            }
          >
            <Users className="h-5 w-5" />
            <span className="hidden sm:inline">Participants</span>
          </button>

          <button
            onClick={toggleChat}
            disabled={disabled}
            className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
            style={
              showChat
                ? { background: "var(--color-brand)", color: "#fff", border: "none" }
                : { background: "rgba(255,250,245,0.1)", color: "#fffaf5", border: "none" }
            }
          >
            <MessageSquare className="h-5 w-5" />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <div className="mx-2 h-6 w-px hidden sm:block" style={{ background: "#2a2a2a" }} />

          <button
            onClick={leaveMeeting}
            className="h-10 rounded-full flex items-center gap-2 px-4 text-sm font-medium"
            style={{ background: "var(--color-error)", color: "#fff", border: "none" }}
          >
            <PhoneOff className="h-5 w-5" />
            <span className="hidden sm:inline">Rời buổi học</span>
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
}
