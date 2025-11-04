"use client";

import Image from "next/image";
import { Mic, MicOff, Video, VideoOff, Crown } from "lucide-react";
import DefaultAvatar from "@/assets/default-avatar.png";
import { Participant } from "@/types/meet";

interface ParticipantListProps {
  participants: Participant[];
  localParticipant: Participant | null;
}

export default function ParticipantList({
  participants,
  localParticipant,
}: ParticipantListProps) {
  const allParticipants = localParticipant
    ? [localParticipant, ...participants]
    : participants;

  const getRoleIcon = (role: string) => {
    if (role === "teacher" || role === "admin") {
      return <Crown className="w-3 h-3 text-yellow-500" />;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">
          Participants ({allParticipants.length})
        </h3>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {allParticipants.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No participants yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allParticipants.map((participant) => {
              const isLocal = participant.userId === localParticipant?.userId;
              return (
                <div
                  key={participant.userId}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="relative flex-shrink-0 w-10 h-10">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 relative">
                      <Image
                        src={participant.userAvatar || DefaultAvatar}
                        alt={participant.userFullName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    {participant.isOnline ? (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    ) : (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-400 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        {participant.userFullName}
                        {isLocal && " (You)"}
                      </p>
                      {participant.role && getRoleIcon(participant.role)}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {/* Audio indicator */}
                      <div className="flex items-center gap-1">
                        {participant.isAudioEnabled !== false ? (
                          <Mic className="w-3 h-3 text-green-500" />
                        ) : (
                          <MicOff className="w-3 h-3 text-red-500" />
                        )}
                        <span className="text-xs text-gray-500">Audio</span>
                      </div>
                      {/* Video indicator */}
                      <div className="flex items-center gap-1">
                        {participant.isVideoEnabled !== false ? (
                          <Video className="w-3 h-3 text-green-500" />
                        ) : (
                          <VideoOff className="w-3 h-3 text-red-500" />
                        )}
                        <span className="text-xs text-gray-500">Video</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

