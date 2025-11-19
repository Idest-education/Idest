"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Video, Mic, MicOff, VideoOff, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetStore } from "@/hooks/useMeetStore";

export function MeetParticipantsPanel() {
  const participantsObject = useMeetStore((state) => state.participants);
  const allParticipants = useMemo(() => Object.values(participantsObject), [participantsObject]);
  const [showAbsents, setShowAbsents] = useState(false);

  const onlineParticipants = useMemo(
    () => allParticipants.filter((p) => p.isOnline),
    [allParticipants],
  );
  const offlineParticipants = useMemo(
    () => allParticipants.filter((p) => !p.isOnline),
    [allParticipants],
  );

  const displayedParticipants = showAbsents ? allParticipants : onlineParticipants;
  const allJoined = offlineParticipants.length === 0 && onlineParticipants.length > 0;

  return (
    <div className="flex h-full w-full sm:w-72 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm">
      <div className="flex-shrink-0 border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            Participants ({displayedParticipants.length})
          </div>
          {offlineParticipants.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAbsents(!showAbsents)}
              className="h-7 text-xs"
            >
              {showAbsents ? "Hide absents" : "Show absents"}
            </Button>
          )}
        </div>
        {allJoined && (
          <p className="mt-1 text-xs text-green-600 font-medium">All joined!</p>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {showAbsents && onlineParticipants.length > 0 && offlineParticipants.length > 0 ? (
          <>
            {/* Online participants */}
            {onlineParticipants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between rounded-lg border border-border/40 p-3"
              >
                <div className="flex items-center gap-3">
                  {participant.userAvatar ? (
                    <Image
                      src={participant.userAvatar}
                      alt={participant.userFullName}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                      {participant.userFullName.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{participant.userFullName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{participant.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {participant.isAudioEnabled ? (
                    <Mic className="h-4 w-4" />
                  ) : (
                    <MicOff className="h-4 w-4 text-destructive" />
                  )}
                  {participant.isVideoEnabled ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <VideoOff className="h-4 w-4 text-destructive" />
                  )}
                  <CircleDot className="h-3 w-3 text-green-500" />
                </div>
              </div>
            ))}

            {/* Separator */}
            <div className="my-3 flex items-center gap-2">
              <div className="flex-1 border-t border-border/40"></div>
              <span className="text-xs font-medium text-muted-foreground uppercase">Absent</span>
              <div className="flex-1 border-t border-border/40"></div>
            </div>

            {/* Offline participants */}
            {offlineParticipants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between rounded-lg border border-border/40 p-3 opacity-60"
              >
                <div className="flex items-center gap-3">
                  {participant.userAvatar ? (
                    <Image
                      src={participant.userAvatar}
                      alt={participant.userFullName}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                      {participant.userFullName.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{participant.userFullName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{participant.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {participant.isAudioEnabled ? (
                    <Mic className="h-4 w-4" />
                  ) : (
                    <MicOff className="h-4 w-4 text-destructive" />
                  )}
                  {participant.isVideoEnabled ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <VideoOff className="h-4 w-4 text-destructive" />
                  )}
                  <CircleDot className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>
            ))}
          </>
        ) : (
          // No separator needed - show all participants normally
          displayedParticipants.map((participant) => (
            <div
              key={participant.userId}
              className="flex items-center justify-between rounded-lg border border-border/40 p-3"
            >
              <div className="flex items-center gap-3">
                {participant.userAvatar ? (
                  <Image
                    src={participant.userAvatar}
                    alt={participant.userFullName}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                    {participant.userFullName.slice(0, 2)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{participant.userFullName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{participant.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {participant.isAudioEnabled ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4 text-destructive" />
                )}
                {participant.isVideoEnabled ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4 text-destructive" />
                )}
                <CircleDot
                  className={`h-3 w-3 ${
                    participant.isOnline ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
              </div>
            </div>
          ))
        )}

        {displayedParticipants.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {showAbsents ? "No participants yet." : "No participants online."}
          </p>
        )}
      </div>
    </div>
  );
}

