"use client";

import { useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { useMeetStore } from "@/hooks/useMeetStore";
import { ScreenSharePayload, ToggleMediaPayload } from "@/types/meet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  const disabled = !sessionId || !room;

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
    // Assuming roles are 'teacher' or 'admin' for recording permission
    // Adjust this check based on your actual role values
    return localParticipant?.role === 'teacher' || localParticipant?.role === 'admin';
  }, [localUserId, participants]);

  const toggleAudio = useCallback(async () => {
    if (!room || !sessionId) return;
    try {
      const nextState = !isAudioEnabled;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      emitToggleMedia({ sessionId, type: "audio", isEnabled: nextState });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to toggle microphone";
      toast.error(message);
    }
  }, [emitToggleMedia, isAudioEnabled, room, sessionId]);

  const toggleVideo = useCallback(async () => {
    if (!room || !sessionId) return;
    try {
      const nextState = !isVideoEnabled;
      await room.localParticipant.setCameraEnabled(nextState);
      emitToggleMedia({ sessionId, type: "video", isEnabled: nextState });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to toggle camera";
      toast.error(message);
    }
  }, [emitToggleMedia, isVideoEnabled, room, sessionId]);

  const toggleScreenShare = useCallback(async () => {
    if (!room || !sessionId) return;
    if (!canShareScreen) {
      toast.error(`Screen is currently being shared by ${activeSharerName}`);
      return;
    }
    try {
      const enable = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(enable);
      emitScreenShareEvent(enable ? "start" : "stop", { sessionId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to toggle screen share";
      toast.error(message);
    }
  }, [emitScreenShareEvent, isScreenSharing, room, sessionId, canShareScreen, activeSharerName]);

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
      <div className="flex-shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2 px-4 py-3 flex-wrap">
          <Button
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="sm"
            onClick={toggleAudio}
            disabled={disabled}
            className="h-10 rounded-full"
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            <span className="ml-2 hidden sm:inline">{isAudioEnabled ? "Mute" : "Unmute"}</span>
          </Button>

          <Button
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="sm"
            onClick={toggleVideo}
            disabled={disabled}
            className="h-10 rounded-full"
          >
            {isVideoEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
            <span className="ml-2 hidden sm:inline">{isVideoEnabled ? "Stop video" : "Start video"}</span>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleScreenShare}
                  disabled={disabled || (!canShareScreen && !isScreenSharing)} // Allow stopping even if conceptually "blocked" (shouldn't happen if logic correct)
                  className="h-10 rounded-full relative"
                >
                  {isScreenSharing ? (
                    <MonitorStop className="h-5 w-5" />
                  ) : (
                    <MonitorUp className="h-5 w-5" />
                  )}
                  <span className="ml-2 hidden sm:inline">
                    {isScreenSharing ? "Stop sharing" : "Share screen"}
                  </span>
                  {!canShareScreen && (
                     <span className="absolute -top-1 -right-1 flex h-3 w-3">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                     </span>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
             {!canShareScreen && (
              <TooltipContent>
                <p>Screen is being shared by {activeSharerName}</p>
              </TooltipContent>
             )}
          </Tooltip>

          {canRecord && (
            <Button
              variant={isRecording ? "destructive" : "secondary"}
              size="sm"
              onClick={toggleRecording}
              disabled={disabled}
              className="h-10 rounded-full"
            >
              {isRecording ? (
                <StopCircle className="h-5 w-5 animate-pulse" />
              ) : (
                <Disc className="h-5 w-5" />
              )}
              <span className="ml-2 hidden sm:inline">
                {isRecording ? "Stop Rec" : "Record"}
              </span>
            </Button>
          )}

          <div className="mx-2 h-6 w-px bg-border hidden sm:block" />

          <Button
            variant={showParticipants ? "default" : "secondary"}
            size="sm"
            onClick={toggleParticipants}
            disabled={disabled}
            className="h-10 rounded-full"
          >
            <Users className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Participants</span>
          </Button>

          <Button
            variant={showChat ? "default" : "secondary"}
            size="sm"
            onClick={toggleChat}
            disabled={disabled}
            className="h-10 rounded-full"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Chat</span>
          </Button>

          <div className="mx-2 h-6 w-px bg-border hidden sm:block" />

          <Button variant="destructive" size="sm" onClick={leaveMeeting} className="h-10 rounded-full">
            <PhoneOff className="h-5 w-5" />
            <span className="ml-2 hidden sm:inline">Leave</span>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
