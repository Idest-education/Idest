"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Mic, MicOff, Video, VideoOff, Monitor, Circle } from "lucide-react";
import DefaultAvatar from "@/assets/default-avatar.png";
import { Participant } from "@/types/meet";

interface VideoTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  isRecording?: boolean;
  className?: string;
}

export default function VideoTile({
  participant,
  stream,
  isLocal = false,
  isAudioEnabled = true,
  isVideoEnabled = true,
  isScreenSharing = false,
  isRecording = false,
  className = "",
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isVideoEnabled]);

  const displayName = participant.userFullName || "Unknown";
  const avatar = participant.userAvatar || DefaultAvatar;

  return (
    <div
      className={`relative bg-gray-900 rounded-lg overflow-hidden ${isScreenSharing ? '' : 'aspect-video'} ${className}`}
    >
      {stream && isVideoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${isScreenSharing ? 'object-contain max-w-full max-h-full' : 'object-cover scale-x-[-1]'}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-2 relative overflow-hidden bg-gray-700">
              <Image
                src={avatar}
                alt={displayName}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <p className="text-white text-sm font-medium">{displayName}</p>
          </div>
        </div>
      )}

      {/* Overlay with name and controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium truncate">
              {displayName}
              {isLocal && " (You)"}
            </p>
            {participant.role && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                {participant.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAudioEnabled ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <MicOff className="w-4 h-4 text-red-500" />
            )}
            {isVideoEnabled ? (
              <Video className="w-4 h-4 text-white" />
            ) : (
              <VideoOff className="w-4 h-4 text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Connection and recording indicators */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-md animate-pulse">
            <Circle className="w-2 h-2 fill-current" />
            <span className="text-xs font-medium">REC</span>
          </div>
        )}
        
        {/* Connection indicator */}
        {participant.isOnline ? (
          <div className="w-3 h-3 bg-green-500 rounded-full" />
        ) : (
          <div className="w-3 h-3 bg-gray-400 rounded-full" />
        )}
      </div>

      {/* Screen sharing indicator */}
      {isScreenSharing && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-md">
          <Monitor className="w-3 h-3" />
          <span className="text-xs font-medium">Sharing</span>
        </div>
      )}
    </div>
  );
}

