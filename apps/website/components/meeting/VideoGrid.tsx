"use client";

import { useMemo } from "react";
import VideoTile from "./VideoTile";
import { Participant } from "@/types/meet";

interface VideoGridProps {
  localParticipant: Participant | null;
  localStream: MediaStream | null;
  isLocalAudioEnabled: boolean;
  isLocalVideoEnabled: boolean;
  isLocalScreenSharing: boolean;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
}

export default function VideoGrid({
  localParticipant,
  localStream,
  isLocalAudioEnabled,
  isLocalVideoEnabled,
  isLocalScreenSharing,
  participants,
  remoteStreams,
}: VideoGridProps) {
  // Calculate grid layout based on number of participants (including local)
  const totalParticipants = participants.length + (localParticipant ? 1 : 0);

  const gridClass = useMemo(() => {
    if (totalParticipants === 0) {
      return "grid-cols-1";
    } else if (totalParticipants === 1) {
      return "grid-cols-1";
    } else if (totalParticipants === 2) {
      return "grid-cols-2";
    } else if (totalParticipants <= 4) {
      return "grid-cols-2";
    } else if (totalParticipants <= 9) {
      return "grid-cols-3";
    } else {
      return "grid-cols-4";
    }
  }, [totalParticipants]);

  // Create combined participants list (local first, then remote)
  const allParticipants = useMemo(() => {
    const list: Array<{
      participant: Participant;
      stream: MediaStream | null;
      isLocal: boolean;
      isAudioEnabled: boolean;
      isVideoEnabled: boolean;
    }> = [];

    // Add local participant first
    if (localParticipant && localStream) {
      list.push({
        participant: localParticipant,
        stream: localStream,
        isLocal: true,
        isAudioEnabled: isLocalAudioEnabled,
        isVideoEnabled: isLocalVideoEnabled,
      });
    }

    // Add remote participants
    participants.forEach((participant) => {
      list.push({
        participant,
        stream: remoteStreams.get(participant.userId) || null,
        isLocal: false,
        isAudioEnabled: true, // TODO: Get from participant state if available
        isVideoEnabled: true, // TODO: Get from participant state if available
      });
    });

    return list;
  }, [
    localParticipant,
    localStream,
    isLocalAudioEnabled,
    isLocalVideoEnabled,
    participants,
    remoteStreams,
  ]);

  if (totalParticipants === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 rounded-lg">
        <p className="text-gray-400">Waiting for participants to join...</p>
      </div>
    );
  }

  // Screen sharing layout: show shared screen large, participants small sidebar
  if (isLocalScreenSharing && allParticipants.length > 0) {
    const sharingParticipant = allParticipants[0]; // Local participant is sharing
    const otherParticipants = allParticipants.slice(1);

    return (
      <div className="flex h-full gap-4">
        {/* Main screen share */}
        <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden">
          <VideoTile
            key={sharingParticipant.participant.userId}
            participant={sharingParticipant.participant}
            stream={sharingParticipant.stream}
            isLocal={sharingParticipant.isLocal}
            isAudioEnabled={sharingParticipant.isAudioEnabled}
            isVideoEnabled={sharingParticipant.isVideoEnabled}
            className="w-full h-full"
          />
        </div>

        {/* Sidebar with other participants */}
        {otherParticipants.length > 0 && (
          <div className="w-64 flex flex-col gap-2 overflow-y-auto">
            {otherParticipants.map(({ participant, stream, isLocal, isAudioEnabled, isVideoEnabled }) => (
              <VideoTile
                key={participant.userId}
                participant={participant}
                stream={stream}
                isLocal={isLocal}
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular grid layout
  return (
    <div className={`grid ${gridClass} gap-4 h-full`}>
      {allParticipants.map(({ participant, stream, isLocal, isAudioEnabled, isVideoEnabled }) => (
        <VideoTile
          key={participant.userId}
          participant={participant}
          stream={stream}
          isLocal={isLocal}
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
        />
      ))}
    </div>
  );
}

