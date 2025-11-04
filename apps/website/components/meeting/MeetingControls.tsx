"use client";

import { Mic, MicOff, Video, VideoOff, Monitor, LogOut, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  showChat: boolean;
  showParticipants: boolean;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  newMessageCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
}

export default function MeetingControls({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  showChat,
  showParticipants,
  onToggleChat,
  onToggleParticipants,
  newMessageCount,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
}: MeetingControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-white border-t border-gray-200">
      <Button
        onClick={onToggleAudio}
        variant={isAudioEnabled ? "outline" : "destructive"}
        size="lg"
        className="rounded-full w-14 h-14 p-0"
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioEnabled ? (
          <Mic className="w-6 h-6" />
        ) : (
          <MicOff className="w-6 h-6" />
        )}
      </Button>

      <Button
        onClick={onToggleVideo}
        variant={isVideoEnabled ? "outline" : "destructive"}
        size="lg"
        className="rounded-full w-14 h-14 p-0"
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? (
          <Video className="w-6 h-6" />
        ) : (
          <VideoOff className="w-6 h-6" />
        )}
      </Button>

      <Button
        onClick={onToggleScreenShare}
        variant={isScreenSharing ? "default" : "outline"}
        size="lg"
        className="rounded-full w-14 h-14 p-0"
        title={isScreenSharing ? "Stop sharing" : "Share screen"}
      >
        <Monitor className="w-6 h-6" />
      </Button>

      <div className="w-px h-12 bg-gray-300" />

      <Button
        onClick={onToggleChat}
        variant={showChat ? "default" : "outline"}
        size="lg"
        className="rounded-full w-14 h-14 p-0 relative"
        title={showChat ? "Hide chat" : "Show chat"}
      >
        <MessageCircle className="w-6 h-6" />
        {!showChat && newMessageCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {newMessageCount > 9 ? "9+" : newMessageCount}
          </span>
        )}
      </Button>

      <Button
        onClick={onToggleParticipants}
        variant={showParticipants ? "default" : "outline"}
        size="lg"
        className="rounded-full w-14 h-14 p-0"
        title={showParticipants ? "Hide participants" : "Show participants"}
      >
        <Users className="w-6 h-6" />
      </Button>

      <div className="w-px h-12 bg-gray-300" />

      <Button
        onClick={onLeave}
        variant="destructive"
        size="lg"
        className="rounded-full px-6"
        title="Leave meeting"
      >
        <LogOut className="w-5 h-5 mr-2" />
        Leave
      </Button>
    </div>
  );
}

