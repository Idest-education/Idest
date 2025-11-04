"use client";

import { useMemo } from "react";
import VideoTile from "./VideoTile";
import { Participant } from "@/types/meet";

interface VideoGridProps {
  localParticipant: Participant | null;
  localStream: MediaStream | null;
  localScreenShareStream: MediaStream | null;
  isLocalAudioEnabled: boolean;
  isLocalVideoEnabled: boolean;
  isLocalScreenSharing: boolean;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  remoteScreenShareStreams: Map<string, MediaStream>;
}

export default function VideoGrid({
  localParticipant,
  localStream,
  localScreenShareStream,
  isLocalAudioEnabled,
  isLocalVideoEnabled,
  isLocalScreenSharing,
  participants,
  remoteStreams,
  remoteScreenShareStreams,
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
      isScreenSharing: boolean;
    }> = [];

    // Add local participant first
    if (localParticipant && localStream) {
      list.push({
        participant: localParticipant,
        stream: isLocalScreenSharing && localScreenShareStream ? localScreenShareStream : localStream,
        isLocal: true,
        isAudioEnabled: isLocalAudioEnabled,
        isVideoEnabled: isLocalVideoEnabled,
        isScreenSharing: isLocalScreenSharing,
      });
    }

    // Add remote participants - only include if they have a stream or are actively in the meeting
    participants.forEach((participant) => {
      const hasStream = remoteStreams.has(participant.userId);
      const hasScreenShare = remoteScreenShareStreams.has(participant.userId);
      const isScreenSharing = participant.isScreenSharing ?? false;
      
      // Only add participants who have active streams or are marked as online
      if (hasStream || hasScreenShare || participant.isOnline) {
        // Use screen share stream if available and participant is screen sharing, otherwise use regular stream
        const stream = isScreenSharing && hasScreenShare
          ? remoteScreenShareStreams.get(participant.userId) || null
          : remoteStreams.get(participant.userId) || null;
        
        list.push({
          participant,
          stream,
          isLocal: false,
          isAudioEnabled: participant.isAudioEnabled ?? true,
          isVideoEnabled: participant.isVideoEnabled ?? true,
          isScreenSharing,
        });
      }
    });

    return list;
  }, [
    localParticipant,
    localStream,
    isLocalAudioEnabled,
    isLocalVideoEnabled,
    isLocalScreenSharing,
    participants,
    remoteStreams,
    localScreenShareStream,
    remoteScreenShareStreams,
  ]);

  if (totalParticipants === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 rounded-lg">
        <p className="text-gray-400">Waiting for participants to join...</p>
      </div>
    );
  }

  // Screen sharing layout: show shared screen large, participants small sidebar
  // Check for screen sharing from any participant
  const sharingParticipant = allParticipants.find(p => p.isScreenSharing);
  
  if (sharingParticipant) {
    return (
      <div className="flex flex-col gap-4 h-full overflow-hidden">
        {/* Main screen share */}
        <div className="bg-gray-900 rounded-lg overflow-hidden flex-1 min-h-0 max-h-[70vh] flex items-center justify-center">
          <VideoTile
            key={`${sharingParticipant.participant.userId}-screen`}
            participant={sharingParticipant.participant}
            stream={sharingParticipant.stream}
            isLocal={sharingParticipant.isLocal}
            isAudioEnabled={sharingParticipant.isAudioEnabled}
            isVideoEnabled={true}
            isScreenSharing={true}
            className="w-full h-full max-w-full max-h-full"
          />
        </div>

        {/* Bottom bar with all participants (including the one sharing) */}
        {allParticipants.length > 1 && (
          <div className="w-full flex gap-2 overflow-x-auto pb-2 pt-2 flex-shrink-0">
            {allParticipants.map(({ participant, stream, isLocal, isAudioEnabled, isVideoEnabled }) => (
              <div className="min-w-[160px] max-w-[200px] flex-shrink-0" key={participant.userId}>
                <VideoTile
                  participant={participant}
                  stream={stream}
                  isLocal={isLocal}
                  isAudioEnabled={isAudioEnabled}
                  isVideoEnabled={isVideoEnabled}
                  isScreenSharing={false}
                  className="h-28 w-full"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular grid layout
  return (
    <div className={`grid ${gridClass} gap-4 h-full`}>
      {allParticipants.map(({ participant, stream, isLocal, isAudioEnabled, isVideoEnabled, isScreenSharing }) => (
        <VideoTile
          key={participant.userId}
          participant={participant}
          stream={stream}
          isLocal={isLocal}
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={isScreenSharing}
        />
      ))}
    </div>
  );
}

