"use client";

import { useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMeetStore } from "@/hooks/useMeetStore";
import { ScreenSharePayload, ToggleMediaPayload } from "@/types/meet";

interface MeetControlsProps {
  sessionId: string | null;
  onLeave: () => void;
  emitToggleMedia: (payload: ToggleMediaPayload) => void;
  emitScreenShareEvent: (type: "start" | "stop", payload: ScreenSharePayload) => void;
  toggleChat: () => void;
  toggleParticipants: () => void;
}

export function MeetControls({
  sessionId,
  onLeave,
  emitToggleMedia,
  emitScreenShareEvent,
  toggleChat,
  toggleParticipants,
}: MeetControlsProps) {
  const room = useRoomContext();
  const isAudioEnabled = useMeetStore((state) => state.isAudioEnabled);
  const isVideoEnabled = useMeetStore((state) => state.isVideoEnabled);
  const isScreenSharing = useMeetStore((state) => state.isScreenSharing);
  const showChat = useMeetStore((state) => state.showChat);
  const showParticipants = useMeetStore((state) => state.showParticipants);

  const disabled = !sessionId || !room;

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
    try {
      const enable = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(enable);
      emitScreenShareEvent(enable ? "start" : "stop", { sessionId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to toggle screen share";
      toast.error(message);
    }
  }, [emitScreenShareEvent, isScreenSharing, room, sessionId]);

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
    <div className="flex-shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2 px-4 py-3">
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

        <Button
          variant="secondary"
          size="sm"
          onClick={toggleScreenShare}
          disabled={disabled}
          className="h-10 rounded-full"
        >
          {isScreenSharing ? (
            <MonitorStop className="h-5 w-5" />
          ) : (
            <MonitorUp className="h-5 w-5" />
          )}
          <span className="ml-2 hidden sm:inline">
            {isScreenSharing ? "Stop sharing" : "Share screen"}
          </span>
        </Button>

        <div className="mx-2 h-6 w-px bg-border" />

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

        <div className="mx-2 h-6 w-px bg-border" />

        <Button variant="destructive" size="sm" onClick={leaveMeeting} className="h-10 rounded-full">
          <PhoneOff className="h-5 w-5" />
          <span className="ml-2 hidden sm:inline">Leave</span>
        </Button>
      </div>
    </div>
  );
}

